import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePageView } from "@/hooks/usePageView";
import {
  useGetLevels,
  getGetLevelsQueryKey,
  useGetExerciseNorms,
  getGetExerciseNormsQueryKey,
  useClaimLevel,
  SportRankCode,
  type Level,
  type MainExerciseStat,
  type SportRank,
  type BwNormEntry,
} from "@workspace/api-client-react";
import { Lock, Trophy, Flame, Check, Dumbbell, AlertTriangle, ChevronRight, Zap, Info, ChevronDown, ChevronUp, ArrowUpCircle } from "lucide-react";
import { LevelUpOverlay } from "@/components/LevelUpOverlay";
import { useLevelUpAlert } from "@/hooks/useLevelUpAlert";
import { RankBadge, RankDivider } from "@/components/RankBadge";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { formatKg, formatNumber } from "@/lib/format";
import { levelImage } from "@/lib/tierImages";
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


function formatPenaltyPct(mul: number): string {
  return `+${Math.round((mul - 1) * 100)}%`;
}

export function Levels() {
  usePageView("/levels");
  const { data, isLoading } = useGetLevels();

  const currentRef = useRef<HTMLButtonElement | null>(null);
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [showPast, setShowPast] = useState(false);
  const { levelUpInfo, dismissLevelUpInfo } = useLevelUpAlert(data);
  const queryClient = useQueryClient();
  const claimMutation = useClaimLevel({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
      },
    },
  });

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
    maxClaimableLevel,
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
      ? Math.min(100, (stats.currentTonnageSinceLevelUp / nextTonnageTarget) * 100)
      : 100;

  const jumpLevels = next ? next.level - confirmedLevel : 0;
  const showNextLevelPenalty = next && nextLevelPenaltyMultiplier > 1;

  return (
    <AppShell>
      {levelUpInfo && (
        <LevelUpOverlay
          newLevel={levelUpInfo.level}
          levelName={levelUpInfo.name}
          onDismiss={dismissLevelUpInfo}
        />
      )}
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
                  style={{ imageRendering: "pixelated", transform: sex === "male" ? "scale(0.88)" : undefined }}
                />
                <div className="glitch-on-change absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full h-10 w-10 flex items-center justify-center font-bold text-sm shadow-lg">
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

              <div className="chromatic text-2xl font-bold">{current.name}</div>
              <RankBadge rank={currentRank} variant="hero" />
              {currentRank.code !== "NONE" && (
                <div className="text-[11px] text-muted-foreground/70 -mt-1">
                  Весовая категория до {weightClassKg} кг
                </div>
              )}
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {current.description}
              </p>
              {confirmedLevelMigrationNeeded && (
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
              <NextLevelProgressCard
                next={next}
                currentTonnage={stats.currentTonnageSinceLevelUp}
                targetTonnage={nextTonnageTarget}
                tonnageProgress={tonnageProgress}
                passedCount={passedCount}
                levelUpAt={stats.levelUpAt ?? null}
                showPenalty={!!showNextLevelPenalty}
                jumpLevels={jumpLevels}
                penaltyMultiplier={nextLevelPenaltyMultiplier}
              />
              {passedCount < next.mainExercisesRequired && (
                <MainExercisesGrid exercises={stats.mainExercises} bodyWeightKg={bodyWeightKg} />
              )}
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
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Лестница уровней</h2>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Тоннаж считается за последние 7 дней</p>
          </div>
          {currentLevel > 0 && (
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors shrink-0 pt-0.5"
            >
              {showPast ? (
                <>Скрыть пройденные <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>Показать пройденные ({currentLevel}) <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {levels.filter((lvl) => showPast || lvl.level >= Math.max(0, currentLevel - 2)).map((lvl, idx, arr) => {
            const isCurrent = lvl.level === currentLevel;
            const isUnlocked = lvl.level <= currentLevel;
            const isNext = lvl.level === currentLevel + 1;
            const prevRankCode = idx > 0 ? arr[idx - 1]!.rank.code : null;
            const isRankStart = prevRankCode !== lvl.rank.code;
            const isClaimable = maxClaimableLevel != null && lvl.level <= maxClaimableLevel && !isUnlocked;
            const showArrow = lvl.level > 0 && !isUnlocked;
            return (
              <div key={lvl.level} className="relative">
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
                    className={`h-16 w-16 object-contain shrink-0 ${isUnlocked ? "" : "opacity-40 grayscale"}`}
                    style={{ imageRendering: "pixelated", transform: sex === "male" ? "scale(0.88)" : undefined }}
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
                          <div className="space-y-0.5">
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
                              const displayLabel = passed && e.maxWeightKg > 0
                                ? `${formatNumber(e.maxWeightKg)} кг`
                                : isTimeBased
                                  ? "Засчитано"
                                  : belowBar
                                    ? "Пустой гриф"
                                    : bwAutoPassed
                                      ? "5 повт."
                                      : req > 0 && !isBw
                                        ? `${formatNumber(req)} кг`
                                        : null;
                              return (
                                <div
                                  key={e.exerciseId}
                                  className={`flex items-baseline gap-1 min-w-0 text-[10px] leading-tight ${passed ? "text-green-400 dark:text-green-400" : "text-muted-foreground/60"}`}
                                >
                                  <span className="break-words min-w-0 flex-1">{short}</span>
                                  {displayLabel && (
                                    <span className="shrink-0 font-mono">{displayLabel}</span>
                                  )}
                                  {isBw && !bwAutoPassed && e.mcKg != null && (
                                    <span className="shrink-0 font-mono">
                                      <BwCompactReq exerciseId={e.exerciseId} required={req} mcKg={e.mcKg} bodyWeightKg={bodyWeightKg} />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/60">
                          {bodyWeightIsFallback && (
                            <span className="text-amber-400/70">расчёт по {formatNumber(bodyWeightKg)} кг · </span>
                          )}
                          Тоннаж: {formatNumber(lvl.tonnage7dKgRequired)} кг
                        </div>
                      </div>
                    )}
                  </div>
                  {!showArrow && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  )}
                </button>
                {showArrow && (
                  <button
                    type="button"
                    disabled={isClaimable && claimMutation.isPending}
                    aria-label={isClaimable ? `Перейти на уровень ${lvl.level}` : `Что нужно для уровня ${lvl.level}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isClaimable) {
                        claimMutation.mutate({ level: lvl.level });
                      } else {
                        setOpenLevel(lvl.level);
                      }
                    }}
                    className={`absolute top-2 right-2 p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      isClaimable
                        ? "text-green-400 hover:text-green-300 hover:bg-green-400/10"
                        : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-accent/30"
                    }`}
                  >
                    <ArrowUpCircle className="h-5 w-5" />
                  </button>
                )}
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
        currentTonnageSinceLevelUp={stats.currentTonnageSinceLevelUp}
        currentLevel={currentLevel}
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
// Prepositions/service words → remove.
// Positional words (лёжа, стоя, сидя …) → keep, they differentiate variants.
const ABBREV_REMOVE = new Set(["штанги", "штангой", "со", "в", "по", "с", "одной"]);
function abbreviateExercise(name: string): string {
  // Short names fit fine — return as-is without any substitution.
  if (name.length <= 16) return name;
  const words = name.split(/\s+/).flatMap((w) => {
    const lower = w.toLowerCase();
    if (ABBREV_REMOVE.has(lower)) return [];
    return [w];
  });
  // Greedily accumulate words while the result stays ≤ 18 chars.
  const MAX_LEN = 18;
  const kept: string[] = [];
  let running = 0;
  for (const w of words) {
    const next = running === 0 ? w.length : running + 1 + w.length;
    if (next > MAX_LEN && kept.length > 0) break;
    kept.push(w);
    running = next;
  }
  const short = kept.join(" ");
  return short.length > MAX_LEN ? short.slice(0, MAX_LEN - 1) + "…" : short;
}

function DialogExerciseRow({
  row,
  bodyWeightKg,
}: {
  row: {
    ex: MainExerciseStat;
    required: number;
    belowBar: boolean;
    isTimeBased: boolean;
    isBw: boolean;
    bwAutoPass: boolean;
    passed: boolean;
  };
  bodyWeightKg: number;
}) {
  const { ex, required, belowBar, isTimeBased, isBw, bwAutoPass, passed } = row;
  const bwRep = useBwRepState(ex.exerciseId, isBw);

  return (
    <div
      className={`flex flex-col gap-0.5 px-3 py-2 rounded-md border ${
        passed ? "border-primary/40 bg-primary/10" : "border-border bg-card/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {passed && <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
          <span className="text-sm font-medium break-words min-w-0">{ex.name}</span>
        </div>
        <div className="text-xs text-right shrink-0">
          {isTimeBased ? (
            <span className="text-primary">Засчитано</span>
          ) : belowBar ? (
            <span className="text-primary">Пустой гриф</span>
          ) : bwAutoPass ? (
            <span className="text-primary">5 повторений</span>
          ) : isBw ? (
            <span className="font-mono text-foreground/80">
              {bwRep && ex.mcKg != null
                ? bwTierLabel(bwRep.repNorms, required, ex.mcKg)
                : `+${formatNumber(Math.max(0, required - bodyWeightKg))} кг доп.`}
            </span>
          ) : (
            <span className="font-mono text-foreground/80">
              {formatKg(required)}
              {ex.equipment === "dumbbell" && (
                <span className="text-muted-foreground/60 font-sans"> (одна гантель)</span>
              )}
            </span>
          )}
        </div>
      </div>
      {!isTimeBased && ex.mcKg != null && (() => {
        if (isBw && bwRep) {
          const userPart = bwRep.currentLabel ? `Сейчас: ${bwRep.currentLabel}` : null;
          if (!bwRep.nextEntry) {
            return (
              <div className="text-[10px] text-primary/70">
                {userPart ? `${userPart} · ` : ""}МСМК достигнут
              </div>
            );
          }
          return (
            <div className="text-[10px] text-muted-foreground/70">
              {userPart ? `${userPart} · ` : ""}до {bwRep.nextEntry.rank.shortLabel}: {bwRep.nextLabel}
            </div>
          );
        }
        if (ex.maxWeightKg === 0) {
          const yun3Target = Math.ceil(ex.mcKg * 0.10 * 10) / 10;
          return (
            <div className="text-[10px] text-muted-foreground/70">
              Первая цель — Юн III: {formatKg(yun3Target)}
              {ex.equipment === "dumbbell" && " (одна гантель)"}
            </div>
          );
        }
        const nr = nextRankFromStats(ex.maxWeightKg, ex.mcKg);
        if (nr) {
          return (
            <div className="text-[10px] text-muted-foreground/70">
              {nr.label}: {formatKg(nr.kgTarget)}
              {ex.equipment === "dumbbell" && " (одна гантель)"}
            </div>
          );
        }
        if (ex.maxWeightKg >= ex.mcKg) {
          return (
            <div className="text-[10px] text-primary/70">
              МСМК: {formatKg(ex.mcKg)}{ex.equipment === "dumbbell" && " (одна гантель)"} — достигнут
            </div>
          );
        }
        return (
          <div className="text-[10px] text-muted-foreground/70">
            МСМК: {formatKg(ex.mcKg)}{ex.equipment === "dumbbell" && " (одна гантель)"}
          </div>
        );
      })()}
    </div>
  );
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
  currentTonnageSinceLevelUp,
  currentLevel,
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
  currentTonnageSinceLevelUp: number;
  currentLevel: number;
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
                  style={{ imageRendering: "pixelated", transform: sex === "male" ? "scale(0.88)" : undefined }}
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
                      {lvl.rank.label}
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
                  {(() => {
                    const isLocked = lvl.level > currentLevel;
                    const missingTonnage = isLocked
                      ? Math.max(0, lvl.tonnage7dKgRequired - currentTonnageSinceLevelUp)
                      : 0;
                    const tonnageDone = isLocked && missingTonnage === 0;
                    return (
                      <div className="bg-muted/40 rounded-xl p-3 flex items-start gap-2">
                        <Flame className={`h-4 w-4 mt-0.5 shrink-0 ${tonnageDone ? "text-green-400" : "text-primary"}`} />
                        <div className="text-sm flex-1 min-w-0">
                          <div className="font-semibold">
                            Тоннаж: {formatNumber(lvl.tonnage7dKgRequired)} кг / 7 дн
                          </div>
                          {isLocked && (
                            <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                              <span className="text-muted-foreground">Сейчас:</span>
                              <span className={tonnageDone ? "text-green-400 font-mono" : "font-mono"}>
                                {formatNumber(currentTonnageSinceLevelUp)} кг
                              </span>
                              {missingTonnage > 0 && (
                                <span className="text-amber-400/80">
                                  — не хватает {formatNumber(missingTonnage)} кг
                                </span>
                              )}
                              {tonnageDone && (
                                <span className="text-green-400">— выполнено</span>
                              )}
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Базовый норматив без учёта штрафа за прыжок через
                            уровни.
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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
                    {rows.length > 0 && (() => {
                      const passedCount = rows.filter(r => r.passed).length;
                      const allPassed = passedCount === rows.length;
                      return (
                        <>
                          <div className={`flex items-center gap-2 text-xs font-mono px-1 ${allPassed ? "text-primary" : "text-amber-400"}`}>
                            {allPassed
                              ? <Check className="h-3.5 w-3.5 shrink-0" />
                              : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            }
                            <span>
                              Выполнено: {passedCount} / {rows.length} упражнений
                              {!allPassed && ` — осталось ${rows.length - passedCount}`}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {rows.map((row) => (
                              <DialogExerciseRow
                                key={row.ex.exerciseId}
                                row={row}
                                bodyWeightKg={bodyWeightKg}
                              />
                            ))}
                          </div>
                        </>
                      );
                    })()}
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

function pluralizeLevels(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "уровень";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "уровня";
  return "уровней";
}


function useBwRepState(exerciseId: number, enabled: boolean) {
  const { data: norms } = useGetExerciseNorms(exerciseId, {
    query: { enabled, queryKey: getGetExerciseNormsQueryKey(exerciseId) },
  });
  const repNorms = norms?.repNorms;
  const userMaxReps = norms?.userMaxRepsAtBodyweight ?? null;
  const userMaxExtra = norms?.userMaxExtraWeightAt30Reps ?? null;

  if (!repNorms?.length) return null;

  let achievedIdx = -1;
  for (let i = repNorms.length - 1; i >= 0; i--) {
    const norm = repNorms[i]!;
    if (norm.extraKg === 0) {
      if (userMaxReps !== null && userMaxReps >= norm.reps) { achievedIdx = i; break; }
    } else {
      if (userMaxExtra !== null && userMaxExtra >= norm.extraKg) { achievedIdx = i; break; }
    }
  }

  const achieved = achievedIdx >= 0 ? repNorms[achievedIdx]! : null;
  const nextEntry = achievedIdx < repNorms.length - 1 ? repNorms[achievedIdx + 1]! : null;

  const currentLabel =
    userMaxExtra !== null && userMaxExtra > 0
      ? `+${formatNumber(userMaxExtra)} кг доп.`
      : userMaxReps !== null && userMaxReps > 0
        ? `${userMaxReps} повт.`
        : null;

  const nextLabel = nextEntry
    ? nextEntry.extraKg > 0
      ? `+${formatNumber(nextEntry.extraKg)} кг доп.`
      : `${nextEntry.reps} повт.`
    : null;

  const barPct = (() => {
    if (!nextEntry) return 100;
    if (nextEntry.extraKg > 0) {
      const extra = userMaxExtra ?? 0;
      return Math.min(100, (extra / nextEntry.extraKg) * 100);
    }
    const reps = userMaxReps ?? 0;
    const prev = achieved?.extraKg === 0 ? (achieved.reps) : 0;
    return Math.min(100, Math.max(0, ((reps - prev) / (nextEntry.reps - prev)) * 100));
  })();

  return { achieved, nextEntry, currentLabel, nextLabel, barPct, userMaxReps, userMaxExtra, repNorms };
}

/**
 * Maps the local RANK_THRESHOLDS_DESC code strings to the server-canonical SportRankCode enum.
 * Used to look up the correct repNorm tier from the API response.
 */
const RANK_CODE_MAP: Partial<Record<string, SportRankCode>> = {
  NONE:  SportRankCode.NONE,
  YUN3:  SportRankCode.YOUTH_III,
  YUN2:  SportRankCode.YOUTH_II,
  YUN1:  SportRankCode.YOUTH_I,
  III:   SportRankCode.III_RAZRYAD,
  II:    SportRankCode.II_RAZRYAD,
  I:     SportRankCode.I_RAZRYAD,
  KMS:   SportRankCode.KMS,
  MS:    SportRankCode.MS,
  MSMC:  SportRankCode.MSMC,
};

/**
 * Returns the rank-matched rep norm label for a level requirement.
 * Computes pct = required / mcKg → looks up rank → finds repNorm entry for that rank.
 * Returns "N повт." for rep-only tiers or "+N кг доп." for extra-weight tiers.
 */
function bwTierLabel(repNorms: BwNormEntry[], required: number, mcKg: number): string {
  const rankEntry = exerciseRankFromStats(required, mcKg);
  if (!rankEntry) return "—";
  const sportCode = RANK_CODE_MAP[rankEntry.code];
  if (!sportCode) return "—";
  const tier = repNorms.find((n) => n.rank.code === sportCode) ?? repNorms[repNorms.length - 1]!;
  return tier.extraKg > 0
    ? `+${formatNumber(tier.extraKg)} кг доп.`
    : `${tier.reps} повт.`;
}

/**
 * Compact BW requirement label for level-card rows.
 * Fetches repNorms and maps the level requirement to its rank-equivalent tier label.
 * Falls back to "+X кг доп." when repNorms are unavailable (e.g. Планка, loading).
 */
function BwCompactReq({
  exerciseId,
  required,
  mcKg,
  bodyWeightKg,
}: {
  exerciseId: number;
  required: number;
  mcKg: number;
  bodyWeightKg: number;
}) {
  const bwRep = useBwRepState(exerciseId, true);
  const fallback = `+${formatNumber(Math.max(0, required - bodyWeightKg))} кг доп.`;
  if (!bwRep) return <>{fallback}</>;
  return <>{bwTierLabel(bwRep.repNorms, required, mcKg)}</>;
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

        const currentRankEntry = e.mcKg != null && e.maxWeightKg > 0
          ? exerciseRankFromStats(e.maxWeightKg, e.mcKg)
          : null;

        return (
          <BwAwareGridRow
            key={e.exerciseId}
            e={e}
            bodyWeightKg={bodyWeightKg}
            isBw={isBw}
            bwAutoPass={bwAutoPass}
            autoPassed={autoPassed}
            passed={passed}
            required={required}
            showPenaltyHint={showPenaltyHint}
            rowPenalty={rowPenalty}
            currentRankEntry={currentRankEntry}
          />
        );
      })}
    </div>
  );
}

function NextLevelProgressCard({
  next,
  currentTonnage,
  targetTonnage,
  tonnageProgress,
  passedCount,
  levelUpAt,
  showPenalty,
  jumpLevels,
  penaltyMultiplier,
}: {
  next: Level;
  currentTonnage: number;
  targetTonnage: number;
  tonnageProgress: number;
  passedCount: number;
  levelUpAt: string | null;
  showPenalty: boolean;
  jumpLevels: number;
  penaltyMultiplier: number;
}) {
  const tonnageDone = targetTonnage > 0 && currentTonnage >= targetTonnage;
  const exercisesDone = passedCount >= next.mainExercisesRequired;
  const bothDone = tonnageDone && exercisesDone;
  const tonRemaining = Math.max(0, targetTonnage - currentTonnage);
  const exPct = Math.min(100, (passedCount / next.mainExercisesRequired) * 100);

  const windowDayInfo = useMemo(() => {
    if (!levelUpAt) return null;
    const startMs = new Date(levelUpAt).getTime();
    const daysSince = Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24));
    const dayInWindow = Math.min(daysSince + 1, 7);
    return { dayInWindow, rolling: daysSince >= 7 };
  }, [levelUpAt]);

  return (
    <div className={`rounded-2xl p-4 space-y-3 border ${bothDone ? "bg-primary/10 border-primary/40" : "bg-card border-border"}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        До уровня {next.level} — {next.name}
      </div>

      {bothDone ? (
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Check className="h-4 w-4 shrink-0" />
          <span>Все условия выполнены — уровень доступен</span>
        </div>
      ) : (
        <div className="space-y-3">
          {tonnageDone ? (
            <div className="flex items-center gap-2 text-primary">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Тоннаж за 7 дней выполнен</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-primary" />
                  <span>Тоннаж за 7 дней</span>
                </div>
                {windowDayInfo && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                    {windowDayInfo.rolling ? "Скользящее окно" : `День ${windowDayInfo.dayInWindow} из 7`}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums">{formatNumber(currentTonnage)}</span>
                <span className="text-xs text-muted-foreground">
                  / {formatNumber(targetTonnage)} кг · осталось {formatNumber(tonRemaining)} кг
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${tonnageProgress}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          )}

          {exercisesDone ? (
            <div className="flex items-center gap-2 text-primary">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">
                Основные упражнения: {passedCount} / {next.mainExercisesRequired} выполнено
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Dumbbell className="h-3.5 w-3.5" />
                  <span>Основные упражнения</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground/80 shrink-0">
                  {passedCount} / {next.mainExercisesRequired}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary/70 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${exPct}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showPenalty && (
        <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-2">
          <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Прыжок через {jumpLevels - 1}{" "}
            {pluralizeLevels(jumpLevels - 1)}: нормы тоннажа и штанг увеличены на {formatPenaltyPct(penaltyMultiplier)}.
          </span>
        </div>
      )}
    </div>
  );
}

function BwAwareGridRow({
  e,
  bodyWeightKg,
  isBw,
  bwAutoPass,
  autoPassed,
  passed,
  required,
  showPenaltyHint,
  rowPenalty,
  currentRankEntry,
}: {
  e: MainExerciseStat;
  bodyWeightKg: number;
  isBw: boolean;
  bwAutoPass: boolean;
  autoPassed: boolean;
  passed: boolean;
  required: number | null | undefined;
  showPenaltyHint: boolean;
  rowPenalty: number;
  currentRankEntry: ReturnType<typeof exerciseRankFromStats>;
}) {
  const bwRep = useBwRepState(e.exerciseId, isBw);
  const nextRank = !isBw && e.mcKg != null ? nextRankFromStats(e.maxWeightKg, e.mcKg) : null;

  const extraRequired = isBw && required != null ? required - bodyWeightKg : null;
  const userExtra = isBw ? Math.max(0, e.maxWeightKg - bodyWeightKg) : null;

  const kgBarPct =
    required != null && required > 0 && !autoPassed
      ? isBw && extraRequired != null && extraRequired > 0 && userExtra != null
        ? Math.min(100, (userExtra / extraRequired) * 100)
        : Math.min(100, (e.maxWeightKg / required) * 100)
      : null;

  return (
    <div
      className={`flex flex-col gap-1.5 text-xs px-2.5 py-2 rounded-md border ${
        passed
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-card/40 text-muted-foreground"
      }`}
    >
      {/* Row 1: icon + name (truncate) + required weight (shrink-0) + rank badge */}
      <div className="flex items-start gap-2 min-w-0">
        <span className="font-medium min-w-0 break-words flex-1 leading-snug">{e.name}</span>
        {/* Required weight — always visible, never truncated */}
        {e.autoPassedReason === "time_based_exercise" ? (
          <span className="shrink-0 text-[11px] text-primary">Засчитано</span>
        ) : e.autoPassedReason === "below_bar_weight" ? (
          <span className="shrink-0 text-[11px] text-primary">Пустой гриф</span>
        ) : bwAutoPass ? (
          <span className="shrink-0 text-[11px] text-primary">5 повторений</span>
        ) : required != null && required > 0 ? (
          <span className={`shrink-0 font-mono text-[11px] ${passed ? "text-primary" : "text-foreground/70"}`}>
            {isBw
              ? (bwRep && e.mcKg != null
                  ? bwTierLabel(bwRep.repNorms, required, e.mcKg)
                  : `+${formatNumber(Math.max(0, required - bodyWeightKg))} кг`)
              : formatKg(required)}
          </span>
        ) : null}
        {currentRankEntry && currentRankEntry.code !== "NONE" && (
          <span
            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${currentRankEntry.cls}`}
            title={currentRankEntry.label}
          >
            {currentRankEntry.shortLabel}
          </span>
        )}
      </div>

      {/* Row 2: user's current value + progress bar */}
      {!e.autoPassedReason && !bwAutoPass && required != null && required > 0 && (
        <div className="pl-5 space-y-1">
          <span className={`font-mono text-[11px] ${passed ? "text-primary" : "text-foreground/80"}`}>
            {isBw && bwRep?.currentLabel
              ? bwRep.currentLabel
              : isBw
                ? `+${formatNumber(userExtra ?? 0)} кг доп.`
                : `${formatNumber(e.maxWeightKg)} кг`}
          </span>
          {kgBarPct !== null && (
            <div className="h-1 rounded-full overflow-hidden bg-border/60">
              <div
                className={`h-full rounded-full transition-all ${passed ? "bg-primary" : "bg-primary/50"}`}
                style={{ width: `${kgBarPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Row 3: penalty hint or rank next hint */}
      {showPenaltyHint && !autoPassed && required != null && required > 0 && !passed ? (
        <div className="text-[10px] text-amber-400/80 pl-5">
          {formatPenaltyPct(rowPenalty)} из-за прыжка через уровни
        </div>
      ) : isBw && bwRep && !autoPassed ? (
        bwRep.nextEntry ? (
          <div className="text-[10px] text-muted-foreground/60 pl-5">
            до {bwRep.nextEntry.rank.shortLabel}: {bwRep.nextLabel}
          </div>
        ) : (
          <div className="text-[10px] text-primary/70 pl-5">МСМК достигнут ✓</div>
        )
      ) : !autoPassed && !isBw && e.mcKg != null ? (
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
}
