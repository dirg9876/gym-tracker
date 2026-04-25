import { useEffect, useRef } from "react";
import {
  useGetLevels,
  type Level,
  type MainExerciseStat,
} from "@workspace/api-client-react";
import { Lock, Trophy, Flame, Check, Dumbbell, Hourglass, Star, AlertTriangle, ChevronRight, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { formatKg, formatNumber } from "@/lib/format";
import { levelImage } from "@/lib/tierImages";
import { LevelForecastCard } from "@/components/LevelForecastCard";
import { ProfileCard } from "@/components/ProfileCard";
import { AppShell } from "@/components/layout/AppShell";

const TONNAGE_WINDOW_DAYS = 7;
const TONNAGE_WINDOW_MS = TONNAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function formatPenaltyPct(mul: number): string {
  return `+${Math.round((mul - 1) * 100)}%`;
}

export function Levels() {
  const { data, isLoading } = useGetLevels();

  const currentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [data?.currentLevel]);

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
      </AppShell>
    );
  }

  const {
    levels,
    currentLevel,
    bestLevelEver,
    confirmedLevel,
    nextLevelPenaltyMultiplier,
    nextLevelTonnage7dKgRequired,
    stats,
    bodyWeightKg,
    bodyWeightIsFallback,
  } = data;
  const current: Level = levels[currentLevel];
  const next: Level | undefined = levels[currentLevel + 1];

  // Server-canonical effective target (penalty + same rounding as pass check).
  const nextTonnageTarget = nextLevelTonnage7dKgRequired ?? 0;

  const passedExercises = next
    ? stats.mainExercises.filter(
        (e) =>
          e.requiredKgForNextLevel != null &&
          e.requiredKgForNextLevel > 0 &&
          e.maxWeightKg >= e.requiredKgForNextLevel,
      )
    : [];
  const passedCount = passedExercises.length;
  const exerciseProgress = next
    ? Math.min(100, (passedCount / next.mainExercisesRequired) * 100)
    : 100;
  const tonnageProgress =
    next && nextTonnageTarget > 0
      ? Math.min(100, (stats.currentTonnage7dKg / nextTonnageTarget) * 100)
      : 100;

  const oldestSetMs = stats.oldestSetInWindowAt
    ? new Date(stats.oldestSetInWindowAt).getTime()
    : null;
  const daysUntilOldestExpires = oldestSetMs
    ? Math.max(
        0,
        Math.ceil(
          (oldestSetMs + TONNAGE_WINDOW_MS - Date.now()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;
  const droppedFromBest = bestLevelEver > currentLevel;
  const jumpLevels = next ? next.level - confirmedLevel : 0;
  const showNextLevelPenalty = next && nextLevelPenaltyMultiplier > 1;

  return (
    <AppShell>
      <div className="min-h-[100dvh] bg-background pb-24">
      {/* Hero: current level */}
      <div className="bg-gradient-to-b from-primary/10 to-transparent pt-6 pb-6 px-4 border-b border-border">
        <div className="max-w-md mx-auto space-y-4">
          <ProfileCard />

          <div>
            <div className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Твой уровень
            </div>
            <motion.div
              key={current.level}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative">
                <img
                  src={levelImage(current.level, current.tier)}
                  alt={current.name}
                  className="h-40 w-40 object-contain drop-shadow-[0_0_25px_rgba(255,80,40,0.35)]"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full h-10 w-10 flex items-center justify-center font-bold text-sm shadow-lg">
                  {current.level}
                </div>
              </div>
              <div className="text-2xl font-bold">{current.name}</div>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {current.description}
              </p>
              {droppedFromBest && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
                  <Star className="h-3 w-3" />
                  <span>
                    Лучший уровень — {bestLevelEver}. Тоннаж сбросился, верни форму!
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {stats.mainExercises.length < 3 && (
            <Link
              href="/exercises"
              className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-sm hover:bg-amber-500/15 transition-colors"
            >
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">
                  Отметь хотя бы 3 основных упражнения
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Сейчас отмечено {stats.mainExercises.length}. Без них уровень
                  не будет повышаться. Открой «Упражнения» и нажми звёздочку
                  рядом с теми, по которым растёшь.
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            </Link>
          )}

          {next ? (
            <>
              <LevelForecastCard />
              <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    До уровня {next.level} — «{next.name}»
                  </div>
                </div>

                {showNextLevelPenalty && (
                  <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-2">
                    <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Прыжок через {jumpLevels - 1}{" "}
                      {pluralizeLevels(jumpLevels - 1)}: нормы тоннажа и
                      штанг увеличены на {formatPenaltyPct(nextLevelPenaltyMultiplier)}.
                    </span>
                  </div>
                )}

                <ProgressRow
                  icon={<Dumbbell className="h-4 w-4" />}
                  label="Основные упражнения"
                  value={passedCount}
                  target={next.mainExercisesRequired}
                  unit=""
                  progress={exerciseProgress}
                />

                <MainExercisesGrid
                  exercises={stats.mainExercises}
                  penaltyMultiplier={nextLevelPenaltyMultiplier}
                />

                <ProgressRow
                  icon={<Flame className="h-4 w-4" />}
                  label="Тоннаж за последние 7 дней"
                  value={stats.currentTonnage7dKg}
                  target={nextTonnageTarget}
                  unit="кг"
                  progress={tonnageProgress}
                />

                {daysUntilOldestExpires !== null &&
                  stats.currentTonnage7dKg > 0 &&
                  stats.currentTonnage7dKg < nextTonnageTarget && (
                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2.5 py-2">
                      <Hourglass className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        Окно тоннажа — последние 7 дней. Самые ранние подходы «сгорят»
                        через {daysUntilOldestExpires}{" "}
                        {pluralizeDays(daysUntilOldestExpires)}, если не успеешь добрать норму.
                      </span>
                    </div>
                  )}
              </div>
            </>
          ) : (
            <div className="bg-card border border-primary/40 rounded-2xl p-4 flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <div className="text-sm">
                Максимальный уровень. Ты — легенда.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full ladder */}
      <div className="max-w-md mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold mb-3">Лестница уровней</h2>
        <div className="space-y-2">
          {levels.map((lvl) => {
            const isCurrent = lvl.level === currentLevel;
            const isUnlocked = lvl.level <= currentLevel;
            const isNext = lvl.level === currentLevel + 1;
            return (
              <div
                key={lvl.level}
                ref={isCurrent ? currentRef : undefined}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isCurrent
                    ? "border-primary bg-primary/10"
                    : isNext
                      ? "border-primary/40 bg-card"
                      : isUnlocked
                        ? "border-border bg-card/60"
                        : "border-border bg-card/30"
                }`}
              >
                <img
                  src={levelImage(lvl.level, lvl.tier)}
                  alt=""
                  className={`h-12 w-12 object-contain shrink-0 ${isUnlocked ? "" : "opacity-40 grayscale"}`}
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono ${isUnlocked ? "text-primary" : "text-muted-foreground"}`}
                    >
                      LVL {lvl.level}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        сейчас
                      </span>
                    )}
                    {!isUnlocked && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div
                    className={`font-semibold truncate ${isUnlocked ? "" : "text-muted-foreground"}`}
                  >
                    {lvl.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {lvl.description}
                  </div>
                  {lvl.level > 0 && (
                    <div className="text-[11px] text-muted-foreground/80 mt-1">
                      {bodyWeightIsFallback
                        ? `3 упр. по нормативу (укажи вес — сейчас расчёт по ${formatNumber(bodyWeightKg)} кг)`
                        : `3 упр. по нормативу для ${formatNumber(bodyWeightKg)} кг`}
                      {" · Тоннаж "}
                      {formatNumber(lvl.tonnage7dKgRequired)} кг / 7 дн
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </AppShell>
  );
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function pluralizeLevels(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "уровень";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "уровня";
  return "уровней";
}

function ProgressRow({
  icon,
  label,
  value,
  target,
  unit,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  target: number;
  unit: string;
  progress: number;
}) {
  const reached = value >= target;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className={`font-mono ${reached ? "text-primary" : ""}`}>
          {formatNumber(value)}
          {unit && ` / ${formatNumber(target)} ${unit}`}
          {!unit && ` / ${target}`}
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

function MainExercisesGrid({
  exercises,
  penaltyMultiplier,
}: {
  exercises: MainExerciseStat[];
  penaltyMultiplier: number;
}) {
  const showPenaltyHint = penaltyMultiplier > 1;
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {exercises.map((e) => {
        const required = e.requiredKgForNextLevel;
        const passed =
          required != null && required > 0 && e.maxWeightKg >= required;
        return (
          <div
            key={e.exerciseId}
            className={`flex flex-col gap-1 text-xs px-2.5 py-2 rounded-md border ${
              passed
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-card/40 text-muted-foreground"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {passed ? (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                )}
                <span className="truncate font-medium">{e.name}</span>
              </div>
              <div className="flex flex-col items-end shrink-0 leading-tight">
                {required != null && required > 0 ? (
                  <>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      нужно {formatKg(required)}
                    </span>
                    <span
                      className={`font-mono text-[11px] ${passed ? "text-primary" : "text-foreground/80"}`}
                    >
                      сейчас {formatNumber(e.maxWeightKg)} кг
                    </span>
                  </>
                ) : (
                  <span className="font-mono text-[11px] text-foreground/80">
                    сейчас {formatNumber(e.maxWeightKg)} кг
                  </span>
                )}
              </div>
            </div>
            {showPenaltyHint && required != null && required > 0 && !passed && (
              <div className="text-[10px] text-amber-400/80 pl-5">
                {formatPenaltyPct(penaltyMultiplier)} из-за прыжка через уровни
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
