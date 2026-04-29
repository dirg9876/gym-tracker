import { useEffect, useMemo, useRef, useState } from "react";
import { usePageView } from "@/hooks/usePageView";
import {
  useGetLevels,
  type Level,
  type MainExerciseStat,
  type SportRank,
} from "@workspace/api-client-react";
import { Lock, Trophy, Flame, Check, Dumbbell, Hourglass, Star, AlertTriangle, ChevronRight, Zap, Info } from "lucide-react";
import { RankBadge, RankDivider } from "@/components/RankBadge";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { formatKg, formatNumber } from "@/lib/format";
import { levelImage } from "@/lib/tierImages";
import { LevelForecastCard } from "@/components/LevelForecastCard";
import { ProfileCard } from "@/components/ProfileCard";
import { AppShell } from "@/components/layout/AppShell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Client-side rank threshold table (mirrors sport-norms.ts).
// pct = maxWeightKg / mcKg required to reach this rank.
const RANK_THRESHOLDS_DESC: Array<{
  pct: number;
  code: string;
  shortLabel: string;
  label: string;
  tier: number;
  cls: string;
}> = [
  { pct: 0.95, code: "MSMC",  shortLabel: "МСМК",   label: "МСМК",                   tier: 9, cls: "bg-amber-400/20 text-amber-200 border-amber-300/80" },
  { pct: 0.87, code: "MS",    shortLabel: "МС",     label: "Мастер спорта",           tier: 8, cls: "bg-yellow-800/70 text-yellow-200 border-yellow-400/70" },
  { pct: 0.75, code: "KMS",   shortLabel: "КМС",    label: "Кандидат в мастера",      tier: 7, cls: "bg-yellow-900/60 text-yellow-300 border-yellow-500/60" },
  { pct: 0.67, code: "I",     shortLabel: "I р.",   label: "I разряд",                tier: 6, cls: "bg-gray-600/60 text-gray-100 border-gray-300/50" },
  { pct: 0.59, code: "II",    shortLabel: "II р.",  label: "II разряд",               tier: 5, cls: "bg-gray-700/60 text-gray-200 border-gray-400/50" },
  { pct: 0.52, code: "III",   shortLabel: "III р.", label: "III разряд",              tier: 4, cls: "bg-orange-950/70 text-orange-300 border-orange-600/50" },
  { pct: 0.35, code: "YUN1",  shortLabel: "Юн I",  label: "Юношеский I разряд",      tier: 3, cls: "bg-stone-700/60 text-stone-200 border-stone-500/50" },
  { pct: 0.22, code: "YUN2",  shortLabel: "Юн II", label: "Юношеский II разряд",     tier: 2, cls: "bg-slate-700/60 text-slate-300 border-slate-500/50" },
  { pct: 0.10, code: "YUN3",  shortLabel: "Юн III",label: "Юношеский III разряд",    tier: 1, cls: "bg-slate-700/60 text-slate-300 border-slate-500/50" },
  { pct: 0,    code: "NONE",  shortLabel: "Б/Р",   label: "Без разряда",             tier: 0, cls: "bg-zinc-800/60 text-zinc-400 border-zinc-600/50" },
];

function exerciseRankFromStats(maxWeightKg: number, mcKg: number | null): typeof RANK_THRESHOLDS_DESC[number] | null {
  if (mcKg == null || mcKg <= 0 || maxWeightKg <= 0) return null;
  const pct = maxWeightKg / mcKg;
  return RANK_THRESHOLDS_DESC.find((r) => pct >= r.pct) ?? RANK_THRESHOLDS_DESC[RANK_THRESHOLDS_DESC.length - 1]!;
}

function nextRankFromStats(maxWeightKg: number, mcKg: number | null): { label: string; kgTarget: number } | null {
  if (mcKg == null || mcKg <= 0) return null;
  const cur = exerciseRankFromStats(maxWeightKg, mcKg);
  if (!cur || cur.code === "MSMC") return null;
  const curIdx = RANK_THRESHOLDS_DESC.findIndex((r) => r.code === cur.code);
  const nextEntry = RANK_THRESHOLDS_DESC[curIdx - 1]; // one step higher
  if (!nextEntry) return null;
  const kgTarget = Math.ceil(mcKg * nextEntry.pct * 10) / 10;
  return { label: nextEntry.shortLabel, kgTarget };
}

const TONNAGE_WINDOW_DAYS = 7;
const TONNAGE_WINDOW_MS = TONNAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function formatPenaltyPct(mul: number): string {
  return `+${Math.round((mul - 1) * 100)}%`;
}

export function Levels() {
  usePageView("/levels");
  const { data, isLoading } = useGetLevels();

  const currentRef = useRef<HTMLButtonElement | null>(null);
  const [openLevel, setOpenLevel] = useState<number | null>(null);

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
    barWeightKg,
    levelFactorAnchor,
    currentRank,
    weightClassKg,
    confirmedLevelMigrationNeeded,
    sex,
  } = data;
  const current: Level = levels[currentLevel];
  const next: Level | undefined = levels[currentLevel + 1];

  // Server-canonical effective target (penalty + same rounding as pass check).
  const nextTonnageTarget = nextLevelTonnage7dKgRequired ?? 0;

  // Auto-passed exercises (e.g. barbell exercise whose required kg < bar)
  // also count toward the "X из 3" tally, so the user isn't blocked by a
  // physically impossible target on low levels.
  const passedExercises = next
    ? stats.mainExercises.filter(
        (e) =>
          e.autoPassedReason != null ||
          (e.requiredKgForNextLevel != null &&
            e.requiredKgForNextLevel > 0 &&
            e.maxWeightKg >= e.requiredKgForNextLevel),
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
                  src={levelImage(current.level, current.tier, sex)}
                  alt={current.name}
                  className="h-40 w-40 object-contain drop-shadow-[0_0_25px_rgba(255,80,40,0.35)]"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full h-10 w-10 flex items-center justify-center font-bold text-sm shadow-lg">
                  {current.level}
                </div>
              </div>

              {/* Per-exercise sport rank badges */}
              {(() => {
                const exerciseRanks = stats.mainExercises
                  .filter((e) => (e.mcKg ?? 0) > 0 && e.maxWeightKg > 0)
                  .map((e) => ({
                    id: e.exerciseId,
                    name: abbreviateExercise(e.name),
                    entry: exerciseRankFromStats(e.maxWeightKg, e.mcKg)!,
                  }));
                if (exerciseRanks.length === 0) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                    className="flex flex-wrap justify-center gap-2"
                  >
                    {exerciseRanks.map(({ id, name, entry }) => {
                      const rankForBadge: SportRank = {
                        code: entry.code as SportRank["code"],
                        label: entry.label,
                        shortLabel: entry.shortLabel,
                        tier: entry.tier,
                        minLevel: 0,
                      };
                      return (
                        <div key={id} className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground/60 font-medium">{name}</span>
                          <RankBadge rank={rankForBadge} variant="compact" />
                        </div>
                      );
                    })}
                  </motion.div>
                );
              })()}

              <div className="text-2xl font-bold">{current.name}</div>
              <RankBadge rank={currentRank} variant="hero" />
              {currentRank.code !== "NONE" && (
                <div className="text-[11px] text-muted-foreground/70 -mt-1">
                  Класс {weightClassKg} кг
                </div>
              )}
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
              {confirmedLevelMigrationNeeded && !droppedFromBest && (
                <div className="flex items-center gap-1.5 text-[11px] text-blue-400/90 bg-blue-500/10 border border-blue-500/30 rounded-full px-2.5 py-1">
                  <Info className="h-3 w-3" />
                  <span>
                    Нормативы обновлены — перепроверь свои максимумы в упражнениях.
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

                {/* Rank transition hint: "Сейчас твой разряд → Следующий разряд" */}
                {(() => {
                  const nextRankCode = next.rank.code;
                  if (nextRankCode !== currentRank.code) {
                    return (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 bg-muted/30 rounded-md px-2.5 py-2">
                        <span>Твой разряд:</span>
                        <RankBadge rank={currentRank} variant="compact" />
                        <span className="text-muted-foreground/50">→</span>
                        <RankBadge rank={next.rank} variant="compact" />
                        <span className="text-muted-foreground/60">на этом уровне</span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 bg-muted/30 rounded-md px-2.5 py-2">
                      <span>Твой разряд:</span>
                      <RankBadge rank={currentRank} variant="compact" />
                    </div>
                  );
                })()}

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

                <MainExercisesGrid exercises={stats.mainExercises} bodyWeightKg={bodyWeightKg} />

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
          {levels.map((lvl, idx) => {
            const isCurrent = lvl.level === currentLevel;
            const isUnlocked = lvl.level <= currentLevel;
            const isNext = lvl.level === currentLevel + 1;
            const prevRankCode = idx > 0 ? levels[idx - 1]!.rank.code : null;
            const isRankStart = prevRankCode !== lvl.rank.code;
            return (
              <div key={lvl.level}>
                {isRankStart && lvl.rank.code !== "NONE" && (
                  <RankDivider label={lvl.rank.label} />
                )}
                <button
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  onClick={() => setOpenLevel(lvl.level)}
                  aria-label={`Открыть уровень ${lvl.level} — ${lvl.name}`}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-accent/40 ${
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
                    src={levelImage(lvl.level, lvl.tier, sex)}
                    alt=""
                    className={`h-12 w-12 object-contain shrink-0 ${isUnlocked ? "" : "opacity-40 grayscale"}`}
                    style={{ imageRendering: "pixelated" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <RankBadge rank={lvl.rank} variant="compact" />
                    </div>
                    <div
                      className={`font-semibold ${isUnlocked ? "" : "text-muted-foreground"}`}
                    >
                      {lvl.name}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {lvl.description}
                    </div>
                    {lvl.level === 0 ? (
                      <div className="text-[10px] text-muted-foreground/50 mt-1">
                        Без требований
                      </div>
                    ) : (
                      <div className="mt-1 space-y-0.5">
                        {stats.mainExercises.length < 3 ? (
                          <div className="text-[10px] text-amber-400/80">
                            Выбери ≥ 3 основных упражнения на странице «Упражнения»
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {stats.mainExercises.slice(0, 3).map((e) => {
                              const isTimeBased = e.autoPassedReason === "time_based_exercise";
                              const isBw = e.mcSource === "bodyweight";
                              const req = isTimeBased
                                ? 0
                                : requiredKgFor(lvl.level, bodyWeightKg, e.multiplier, levelFactorAnchor);
                              const belowBar = !isTimeBased && !isBw && e.equipment === "barbell" && req > 0 && req < barWeightKg;
                              const bwAutoPassed = isBw && req > 0 && req <= bodyWeightKg;
                              const autoPassed = isTimeBased || belowBar || bwAutoPassed;
                              const passed = autoPassed || (req > 0 && e.maxWeightKg >= req);
                              const short = abbreviateExercise(e.name);
                              let reqLabel: string | null = null;
                              if (!autoPassed && req > 0) {
                                if (isBw) {
                                  reqLabel = `+${formatNumber(req - bodyWeightKg)} кг доп.`;
                                } else {
                                  reqLabel = `${formatNumber(req)} кг`;
                                }
                              }
                              return (
                                <span
                                  key={e.exerciseId}
                                  className={`text-[10px] leading-tight ${passed ? "text-primary" : "text-muted-foreground/60"}`}
                                >
                                  {passed && "✓ "}
                                  {short}
                                  {bwAutoPassed && ": любой подход"}
                                  {reqLabel && `: ${reqLabel}`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/60">
                          {bodyWeightIsFallback && (
                            <span className="text-amber-400/70">расчёт по {formatNumber(bodyWeightKg)} кг · </span>
                          )}
                          Тоннаж: {formatNumber(lvl.tonnage7dKgRequired)} кг / 7 дн
                        </div>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <LevelDetailDialog
        openLevel={openLevel}
        onOpenChange={(open) => {
          if (!open) setOpenLevel(null);
        }}
        levels={levels}
        mainExercises={stats.mainExercises}
        bodyWeightKg={bodyWeightKg}
        bodyWeightIsFallback={bodyWeightIsFallback}
        barWeightKg={barWeightKg}
        levelFactorAnchor={levelFactorAnchor}
        weightClassKg={weightClassKg}
        sex={sex}
      />
      </div>
    </AppShell>
  );
}

// Floor that mirrors the server's MIN_REQUIRED_KG / 2.5-kg rounding step in
// levels.ts. Replicated here (instead of imported) because the server-side
// constant lives in API code; the dialog is informational and explicitly
// labelled "без штрафа за прыжок", so any tiny drift is harmless.
const MIN_REQUIRED_KG = 2.5;
const ROUND_STEP_KG = 2.5;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function levelFactorFor(level: number, anchor: number): number {
  return level / anchor;
}

function requiredKgFor(
  level: number,
  bodyWeightKg: number,
  multiplier: number,
  anchor: number,
): number {
  if (multiplier <= 0 || level <= 0) return 0;
  const raw = bodyWeightKg * levelFactorFor(level, anchor) * multiplier;
  return Math.max(MIN_REQUIRED_KG, roundTo(raw, ROUND_STEP_KG));
}

// Produce a compact label for an exercise name.
// Barbell is the default → remove "штанги"/"штангой" (no info added).
// Dumbbell is distinctive → replace "гантелей"/"гантели" with "гант.".
// Prepositions/service words → remove.
// Positional words (лёжа, стоя, сидя …) → keep, they differentiate variants.
const ABBREV_REMOVE = new Set(["штанги", "штангой", "со", "в", "на", "по", "с", "одной"]);
const ABBREV_REPLACE: Record<string, string> = { гантелей: "гант.", гантели: "гант." };
function abbreviateExercise(name: string): string {
  const words = name.split(/\s+/).flatMap((w) => {
    const lower = w.toLowerCase();
    if (ABBREV_REMOVE.has(lower)) return [];
    if (ABBREV_REPLACE[lower]) return [ABBREV_REPLACE[lower]!];
    return [w];
  });
  const short = words.slice(0, 2).join(" ");
  return short.length > 14 ? short.slice(0, 13) + "…" : short;
}

function LevelDetailDialog({
  openLevel,
  onOpenChange,
  levels,
  mainExercises,
  bodyWeightKg,
  bodyWeightIsFallback,
  barWeightKg,
  levelFactorAnchor,
  weightClassKg,
  sex,
}: {
  openLevel: number | null;
  onOpenChange: (open: boolean) => void;
  levels: Level[];
  mainExercises: MainExerciseStat[];
  bodyWeightKg: number;
  bodyWeightIsFallback: boolean;
  barWeightKg: number;
  levelFactorAnchor: number;
  weightClassKg: number;
  sex: "male" | "female";
}) {
  const lvl = openLevel != null ? levels[openLevel] : undefined;
  const rows = useMemo(() => {
    if (!lvl) return [];
    return mainExercises.map((ex) => {
      const isTimeBased = ex.autoPassedReason === "time_based_exercise";
      const isBw = ex.mcSource === "bodyweight";
      const required = !isTimeBased
        ? requiredKgFor(lvl.level, bodyWeightKg, ex.multiplier, levelFactorAnchor)
        : 0;
      const belowBar =
        !isTimeBased && !isBw && ex.equipment === "barbell" && required > 0 && required < barWeightKg;
      const bwAutoPass = isBw && required > 0 && required <= bodyWeightKg;
      const passed =
        belowBar || bwAutoPass || isTimeBased || (required > 0 && ex.maxWeightKg >= required);
      return { ex, required, belowBar, isTimeBased, isBw, bwAutoPass, passed };
    });
  }, [lvl, mainExercises, bodyWeightKg, barWeightKg, levelFactorAnchor]);

  return (
    <Dialog open={lvl != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        {lvl && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <img
                  src={levelImage(lvl.level, lvl.tier, sex)}
                  alt=""
                  className="h-16 w-16 object-contain shrink-0"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-mono text-primary">
                      LVL {lvl.level}
                    </div>
                    <RankBadge rank={lvl.rank} variant="compact" />
                  </div>
                  <DialogTitle className="text-left text-xl leading-tight">
                    {lvl.name}
                  </DialogTitle>
                  {lvl.rank.code !== "NONE" && (
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {lvl.rank.label} · Класс {weightClassKg} кг
                    </div>
                  )}
                </div>
              </div>
              <DialogDescription className="text-left pt-1">
                {lvl.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {lvl.level === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Стартовый уровень — никаких требований, просто начни
                  тренироваться.
                </div>
              ) : (
                <>
                  <div className="bg-muted/40 rounded-xl p-3 flex items-start gap-2">
                    <Flame className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <div className="font-semibold">
                        Тоннаж: {formatNumber(lvl.tonnage7dKgRequired)} кг / 7 дн
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Базовый норматив без учёта штрафа за прыжок через
                        уровни.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Веса для твоих основных упражнений
                    </div>
                    {bodyWeightIsFallback && (
                      <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-2">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          Расчёт по умолчанию для веса {formatNumber(bodyWeightKg)} кг.
                          Укажи свой вес в профиле — нормативы пересчитаются.
                        </span>
                      </div>
                    )}
                    {rows.length < 3 && (
                      <Link
                        href="/exercises"
                        className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-sm hover:bg-amber-500/15"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold">
                            {rows.length === 0
                              ? "Нет основных упражнений"
                              : `Отмечено только ${rows.length} из 3`}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Отметь хотя бы 3 на странице «Упражнения», чтобы
                            прогресс по уровню считался корректно.
                          </div>
                        </div>
                      </Link>
                    )}
                    {rows.length > 0 && (
                      <div className="space-y-1.5">
                        {rows.map(({ ex, required, belowBar, isTimeBased, isBw, bwAutoPass, passed }) => (
                          <div
                            key={ex.exerciseId}
                            className={`flex flex-col gap-0.5 px-3 py-2 rounded-md border ${
                              passed
                                ? "border-primary/40 bg-primary/10"
                                : "border-border bg-card/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {passed && (
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                )}
                                <span className="text-sm font-medium break-words">
                                  {ex.name}
                                </span>
                              </div>
                              <div className="text-xs text-right shrink-0">
                                {isTimeBased ? (
                                  <span className="text-primary">
                                    Время — засчитано
                                  </span>
                                ) : belowBar ? (
                                  <span className="text-primary">
                                    Ниже грифа — засчитано
                                  </span>
                                ) : bwAutoPass ? (
                                  <span className="text-primary">
                                    Любой подход
                                  </span>
                                ) : isBw ? (
                                  <span className="font-mono text-foreground/80">
                                    +{formatKg(required - bodyWeightKg)} доп.
                                  </span>
                                ) : (
                                  <span className="font-mono text-foreground/80">
                                    {formatKg(required)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {!isTimeBased && ex.mcKg != null && (() => {
                              if (ex.maxWeightKg === 0) {
                                const yun3Target = Math.ceil(ex.mcKg * 0.10 * 10) / 10;
                                return (
                                  <div className="text-[10px] text-muted-foreground/70">
                                    Первая цель — Юн III: {formatKg(yun3Target)}
                                  </div>
                                );
                              }
                              const nr = nextRankFromStats(ex.maxWeightKg, ex.mcKg);
                              if (nr) {
                                return (
                                  <div className="text-[10px] text-muted-foreground/70">
                                    {nr.label}: {formatKg(nr.kgTarget)}
                                  </div>
                                );
                              }
                              if (ex.maxWeightKg >= ex.mcKg) {
                                return (
                                  <div className="text-[10px] text-primary/70">
                                    МСМК достигнут ✓
                                  </div>
                                );
                              }
                              return (
                                <div className="text-[10px] text-muted-foreground/70">
                                  МСМК: {formatKg(ex.mcKg)}
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground/80 pt-1">
                      Норматив = твой вес × коэфф. упражнения × (уровень / 80).
                      Без учёта штрафа за прыжок через уровни.
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  bodyWeightKg,
}: {
  exercises: MainExerciseStat[];
  bodyWeightKg: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {exercises.map((e) => {
        const required = e.requiredKgForNextLevel;
        const isBw = e.mcSource === "bodyweight";
        const bwAutoPass = isBw && required != null && required > 0 && required <= bodyWeightKg;
        const autoPassed = e.autoPassedReason != null || bwAutoPass;
        const passedByLift =
          !autoPassed && required != null && required > 0 && e.maxWeightKg >= required;
        const passed = autoPassed || passedByLift;
        const rowPenalty = e.requiredKgPenaltyMultiplier ?? 1;
        const showPenaltyHint = rowPenalty > 1;

        // For progress bar: for BW exercises, compare extraWeight vs extraRequired
        const extraRequired = isBw && required != null ? required - bodyWeightKg : null;
        const userExtra = isBw ? Math.max(0, e.maxWeightKg - bodyWeightKg) : null;
        const barPct =
          required != null && required > 0 && !autoPassed
            ? isBw && extraRequired != null && extraRequired > 0 && userExtra != null
              ? Math.min(100, (userExtra / extraRequired) * 100)
              : Math.min(100, (e.maxWeightKg / required) * 100)
            : null;

        // Next rank hint
        const nextRank = e.mcKg != null ? nextRankFromStats(e.maxWeightKg, e.mcKg) : null;
        const currentRankEntry = e.mcKg != null && e.maxWeightKg > 0
          ? exerciseRankFromStats(e.maxWeightKg, e.mcKg)
          : null;

        return (
          <div
            key={e.exerciseId}
            className={`flex flex-col gap-1.5 text-xs px-2.5 py-2 rounded-md border ${
              passed
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-card/40 text-muted-foreground"
            }`}
          >
            {/* Row 1: icon + name + rank badge */}
            <div className="flex items-start gap-2">
              {passed ? (
                <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0 mt-0.5" />
              )}
              <span className="font-medium break-words flex-1">{e.name}</span>
              {currentRankEntry && currentRankEntry.code !== "NONE" && (
                <span
                  className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${currentRankEntry.cls}`}
                  title={currentRankEntry.label}
                >
                  {currentRankEntry.shortLabel}
                </span>
              )}
            </div>

            {/* Row 2: auto-passed labels OR weight progress */}
            <div className="pl-5">
              {e.autoPassedReason === "time_based_exercise" ? (
                <span className="text-[11px] text-primary">Время — засчитано</span>
              ) : e.autoPassedReason === "below_bar_weight" ? (
                <span className="text-[11px] text-primary">Ниже грифа — засчитано</span>
              ) : bwAutoPass ? (
                <span className="text-[11px] text-primary">Любой подход — засчитано</span>
              ) : required != null && required > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 leading-tight">
                    <span
                      className={`font-mono text-[11px] ${passed ? "text-primary" : "text-foreground/80"}`}
                    >
                      {isBw
                        ? `+${formatNumber(userExtra ?? 0)} кг доп.`
                        : `${formatNumber(e.maxWeightKg)} кг`}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {isBw && extraRequired != null
                        ? `/ +${formatKg(extraRequired)}`
                        : `/ ${formatKg(required)}`}
                    </span>
                  </div>
                  {barPct !== null && (
                    <div className="h-1 rounded-full overflow-hidden bg-border/60">
                      <div
                        className={`h-full rounded-full transition-all ${passed ? "bg-primary" : "bg-primary/50"}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <span className="font-mono text-[11px] text-foreground/80">
                  {isBw
                    ? `+${formatNumber(Math.max(0, e.maxWeightKg - bodyWeightKg))} кг доп.`
                    : `${formatNumber(e.maxWeightKg)} кг`}
                </span>
              )}
            </div>

            {/* Row 3: penalty hint or MC norm */}
            {showPenaltyHint && !autoPassed && required != null && required > 0 && !passed ? (
              <div className="text-[10px] text-amber-400/80 pl-5">
                {formatPenaltyPct(rowPenalty)} из-за прыжка через уровни
              </div>
            ) : !autoPassed && e.mcKg != null ? (
              <div className="text-[10px] text-muted-foreground/60 pl-5">
                {nextRank
                  ? `до ${nextRank.label}: ${formatKg(nextRank.kgTarget)}`
                  : e.maxWeightKg >= e.mcKg
                    ? "МС достигнут ✓"
                    : `МС: ${formatKg(e.mcKg)}`}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
