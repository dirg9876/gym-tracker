import { useEffect, useRef, useState, useMemo } from "react";
import {
  type ProgramPlan,
  type WorkoutSet,
  type PlannedExercise,
  type Exercise,
  getExerciseLastSets,
} from "@workspace/api-client-react";
import { Check, ChevronRight, Minus, Plus, SkipForward, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExercisePicker } from "@/components/ExercisePicker";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PreviousSets } from "@/components/PreviousSets";
import { isBodyweight } from "@/lib/equipment";

const intentLabel: Record<string, { label: string; color: string }> = {
  strength: { label: "Сила", color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  hypertrophy: { label: "Масса", color: "text-primary bg-primary/10 border-primary/30" },
  accessory: { label: "Добивка", color: "text-muted-foreground bg-muted/40 border-border" },
};

function MiniStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  label: string;
}) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-transform"
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-14 text-center font-black text-xl tabular-nums">{fmt(value)}</span>
        <button
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-transform"
          onClick={() => onChange(+(value + step).toFixed(2))}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface Props {
  plan: ProgramPlan;
  workoutSets: WorkoutSet[];
  bodyWeightKg: number;
  exercises: Exercise[];
  onLogSet: (exerciseId: number, reps: number, weightKg: number) => void;
  onDeleteSet: (setId: number) => void;
  onFinish: () => void;
  onPlanChange: (plan: ProgramPlan) => void;
  isLoggingSet: boolean;
  isFinishing: boolean;
}

export function ProgramWorkoutView({
  plan,
  workoutSets,
  bodyWeightKg,
  exercises,
  onLogSet,
  onDeleteSet,
  onFinish,
  onPlanChange,
  isLoggingSet,
  isFinishing,
}: Props) {
  const loggedMap = useMemo(() => {
    const map = new Map<number, WorkoutSet[]>();
    for (const s of workoutSets) {
      if (!map.has(s.exerciseId)) map.set(s.exerciseId, []);
      map.get(s.exerciseId)!.push(s);
    }
    return map;
  }, [workoutSets]);

  const [skippedMap, setSkippedMap] = useState<Map<number, number>>(new Map());
  const [activeReps, setActiveReps] = useState(10);
  const [activeWeight, setActiveWeight] = useState(20);
  const [editMode, setEditMode] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const currentCardRef = useRef<HTMLDivElement | null>(null);
  const stepperScrollRef = useRef<HTMLDivElement | null>(null);
  const currentPillRef = useRef<HTMLButtonElement | null>(null);

  const currentExercise = plan.exercises.find((ex) => {
    const logged = loggedMap.get(ex.exerciseId)?.length ?? 0;
    const skipped = skippedMap.get(ex.exerciseId) ?? 0;
    return logged + skipped < ex.sets;
  });

  const isAllDone = !currentExercise;

  useEffect(() => {
    if (!currentExercise) return;
    const mid = Math.max(1, Math.round((currentExercise.repsMin + currentExercise.repsMax) / 2));
    setActiveReps(mid);
    setActiveWeight(
      currentExercise.isBodyweight ? 0 : Math.max(0, currentExercise.suggestedWeightKg),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExercise?.exerciseId]);

  useEffect(() => {
    if (currentCardRef.current) {
      setTimeout(() => {
        currentCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 150);
    }
    if (currentPillRef.current && stepperScrollRef.current) {
      setTimeout(() => {
        currentPillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }, 100);
    }
  }, [currentExercise?.exerciseId]);

  const handleLog = () => {
    if (!currentExercise || isLoggingSet) return;
    if (currentExercise.isBodyweight && bodyWeightKg <= 0) {
      toast.error(
        "Подожди секунду — загружаем твой вес. Если он не подгрузится, укажи его в профиле.",
      );
      return;
    }
    const submitted = currentExercise.isBodyweight
      ? Math.max(0, bodyWeightKg + activeWeight)
      : activeWeight;
    onLogSet(currentExercise.exerciseId, activeReps, submitted);
  };

  const handleSkip = () => {
    if (!currentExercise) return;
    setSkippedMap((prev) => {
      const next = new Map(prev);
      next.set(currentExercise.exerciseId, (prev.get(currentExercise.exerciseId) ?? 0) + 1);
      return next;
    });
  };

  const handleRemoveExercise = (exerciseId: number) => {
    onPlanChange({ ...plan, exercises: plan.exercises.filter((e) => e.exerciseId !== exerciseId) });
  };

  const handleAddExercise = async (exerciseId: number) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const alreadyInPlan = plan.exercises.some((e) => e.exerciseId === ex.id);
    if (alreadyInPlan) {
      toast.error("Упражнение уже есть в плане");
      return;
    }

    setAddPickerOpen(false);
    setIsAddingExercise(true);

    let suggestedWeightKg = 0;
    try {
      const lastSets = await getExerciseLastSets(ex.id);
      if (lastSets.sets.length > 0) {
        const maxWeight = Math.max(...lastSets.sets.map((s) => s.weightKg));
        if (maxWeight > 0 && !isBodyweight(ex.equipment)) {
          suggestedWeightKg = maxWeight;
        }
      }
    } catch {
      // fallback to 0
    } finally {
      setIsAddingExercise(false);
    }

    const newEntry: PlannedExercise = {
      exerciseId: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: 3,
      repsMin: 8,
      repsMax: 12,
      intent: "accessory",
      suggestedWeightKg,
      isBodyweight: isBodyweight(ex.equipment),
      equipment: ex.equipment ?? "other",
      basedOn: "level-benchmark",
      note: null,
    };
    onPlanChange({ ...plan, exercises: [...plan.exercises, newEntry] });
    toast.success(`Добавлено: ${ex.name}`);
  };

  const totalPlanned = plan.exercises.reduce((s, ex) => s + ex.sets, 0);
  const totalProcessed = plan.exercises.reduce(
    (s, ex) =>
      s + (loggedMap.get(ex.exerciseId)?.length ?? 0) + (skippedMap.get(ex.exerciseId) ?? 0),
    0,
  );

  const progressPct = totalPlanned > 0 ? (totalProcessed / totalPlanned) * 100 : 0;

  return (
    <div className="space-y-3 pb-28">
      {/* Header row */}
      <div className="flex items-center justify-between py-1">
        <h2 className="text-base font-black tracking-tight truncate mr-2">{plan.name}</h2>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {totalProcessed} / {totalPlanned} подх.
          </span>
          <button
            onClick={() => setEditMode((v) => !v)}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
              editMode
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-label={editMode ? "Выйти из редактирования" : "Изменить состав"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          Режим редактирования — удалите или добавьте упражнения
        </div>
      )}

      {/* Exercise stepper strip */}
      <div
        ref={stepperScrollRef}
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {plan.exercises.map((ex, exIdx) => {
          const logged = loggedMap.get(ex.exerciseId)?.length ?? 0;
          const skipped = skippedMap.get(ex.exerciseId) ?? 0;
          const processed = logged + skipped;
          const isDone = processed >= ex.sets;
          const isCurrent = currentExercise?.exerciseId === ex.exerciseId;

          return (
            <button
              key={`pill-${ex.exerciseId}-${exIdx}`}
              ref={isCurrent ? currentPillRef : null}
              onClick={() => {
                const cardEl = document.getElementById(`ex-card-${ex.exerciseId}-${exIdx}`);
                cardEl?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={cn(
                "flex-shrink-0 flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-all",
                "min-w-[100px] max-w-[130px]",
                isCurrent && "border-primary/60 bg-primary/10",
                isDone && !isCurrent && "border-border bg-card opacity-60",
                !isCurrent && !isDone && "border-border/50 bg-card opacity-35",
              )}
            >
              <div className="flex items-center gap-1.5 w-full">
                <span
                  className={cn(
                    "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center",
                    isDone && "bg-primary/20",
                    isCurrent && !isDone && "bg-primary/30",
                    !isCurrent && !isDone && "border border-border",
                  )}
                >
                  {isDone ? (
                    <Check className="h-2.5 w-2.5 text-primary" />
                  ) : isCurrent ? (
                    <ChevronRight className="h-2.5 w-2.5 text-primary" />
                  ) : null}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                  {processed}/{ex.sets}
                </span>
              </div>
              <span className="text-[11px] font-semibold leading-tight line-clamp-2 w-full">
                {ex.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground text-right">
          {totalProcessed} из {totalPlanned} подходов
        </div>
      </div>

      {plan.exercises.map((ex, exIdx) => {
        const logged = loggedMap.get(ex.exerciseId) ?? [];
        const skipped = skippedMap.get(ex.exerciseId) ?? 0;
        const processed = logged.length + skipped;
        const isCurrent = currentExercise?.exerciseId === ex.exerciseId;
        const isDone = processed >= ex.sets;
        const intent = intentLabel[ex.intent] ?? intentLabel.accessory;
        const canRemove = editMode && logged.length === 0;

        return (
          <div
            key={`${ex.exerciseId}-${exIdx}`}
            id={`ex-card-${ex.exerciseId}-${exIdx}`}
            ref={isCurrent ? currentCardRef : null}
            className={cn(
              "rounded-2xl border p-4 transition-all duration-300",
              isCurrent && "border-primary/60 bg-primary/5 shadow-sm",
              isDone && !isCurrent && "border-border bg-card opacity-70",
              !isCurrent && !isDone && "border-border bg-card opacity-40",
              editMode && "border-dashed",
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-muted-foreground mb-0.5">
                  #{exIdx + 1} · {ex.muscleGroup}
                </div>
                <div className="font-bold leading-tight">{ex.name}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                {canRemove ? (
                  <button
                    onClick={() => handleRemoveExercise(ex.exerciseId)}
                    className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 active:bg-destructive/30 transition-colors"
                    aria-label={`Удалить ${ex.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <span className="text-xs font-mono text-muted-foreground">
                      {processed}/{ex.sets}
                    </span>
                    {isDone && <Check className="h-4 w-4 text-primary" />}
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${intent.color}`}
                    >
                      {intent.label}
                    </span>
                  </>
                )}
              </div>
            </div>

            {!editMode && isCurrent && (
              <div className="mb-3">
                <PreviousSets
                  exerciseId={ex.exerciseId}
                  onRepeatLast={(w, r) => {
                    if (ex.isBodyweight) {
                      setActiveWeight(Math.max(0, +(w - bodyWeightKg).toFixed(2)));
                    } else {
                      setActiveWeight(w);
                    }
                    setActiveReps(r);
                  }}
                />
              </div>
            )}

            {!editMode && (
              <div className="space-y-2">
                {Array.from({ length: ex.sets }, (_, i) => {
                  const isDoneSet = i < logged.length;
                  const isSkippedSet = !isDoneSet && i < processed;
                  const isCurrentSet = isCurrent && i === processed;

                  if (isDoneSet) {
                    const s = logged[i]!;
                    const w = s.weightKg;
                    const display =
                      w > 0
                        ? `${Number.isInteger(w) ? w : w.toFixed(1)} кг × ${s.reps} повт`
                        : `${s.reps} повт`;
                    return (
                      <div
                        key={`done-${s.id}`}
                        className="flex items-center gap-3 py-2 px-3 rounded-xl bg-primary/10 border border-primary/20"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-mono font-bold flex-1">{display}</span>
                        {logged.length > 1 && (
                          <button
                            onClick={() => onDeleteSet(s.id)}
                            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors shrink-0"
                            aria-label="Удалить подход"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (isSkippedSet) {
                    return (
                      <div
                        key={`skipped-${i}`}
                        className="flex items-center gap-3 py-2 px-3 rounded-xl bg-muted/30 border border-border/50"
                      >
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">Пропущен</span>
                      </div>
                    );
                  }

                  if (isCurrentSet) {
                    const planReps =
                      ex.repsMin === ex.repsMax
                        ? `${ex.repsMin}`
                        : `${ex.repsMin}–${ex.repsMax}`;
                    const planWeightStr = ex.isBodyweight
                      ? "свой вес"
                      : ex.suggestedWeightKg > 0
                        ? `${ex.suggestedWeightKg} кг`
                        : null;

                    return (
                      <motion.div
                        key={`current-${i}`}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl border-2 border-primary/40 bg-card p-4 space-y-4"
                      >
                        <div className="text-xs text-center text-muted-foreground">
                          Подход {i + 1} · план:{" "}
                          <span className="font-semibold text-foreground">{planReps} повт</span>
                          {planWeightStr && (
                            <>
                              {" · "}
                              <span className="font-semibold text-foreground">{planWeightStr}</span>
                            </>
                          )}
                        </div>

                        <div className="flex justify-center gap-8">
                          <MiniStepper
                            label={ex.isBodyweight ? "Доп. вес кг" : "Вес кг"}
                            value={activeWeight}
                            onChange={setActiveWeight}
                            step={2.5}
                            min={0}
                          />
                          <MiniStepper
                            label="Повторения"
                            value={activeReps}
                            onChange={setActiveReps}
                            step={1}
                            min={1}
                          />
                        </div>

                        {ex.isBodyweight && bodyWeightKg > 0 && (
                          <div className="text-[11px] text-center text-muted-foreground">
                            Итого: {bodyWeightKg + activeWeight} кг (свой вес + {activeWeight} кг доп.)
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 font-bold rounded-xl h-12"
                            onClick={handleLog}
                            disabled={isLoggingSet}
                          >
                            <Check className="h-4 w-4 mr-1.5" />
                            {isLoggingSet ? "Сохранение..." : "Выполнено"}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl h-12 px-4 gap-1.5 text-muted-foreground"
                            onClick={handleSkip}
                            disabled={isLoggingSet}
                          >
                            <SkipForward className="h-4 w-4" />
                            Пропустить
                          </Button>
                        </div>
                      </motion.div>
                    );
                  }

                  return (
                    <div
                      key={`planned-${i}`}
                      className="flex items-center gap-3 py-2 px-3 rounded-xl opacity-35"
                    >
                      <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`} повт
                        {!ex.isBodyweight && ex.suggestedWeightKg > 0 && ` · ${ex.suggestedWeightKg} кг`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {editMode && logged.length > 0 && (
              <div className="text-[11px] text-muted-foreground mt-1">
                {logged.length} подх. уже выполнено — удаление недоступно
              </div>
            )}

            {!editMode && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                <span className="text-[11px] text-muted-foreground flex-1">
                  Подходы: {ex.sets}
                </span>
                {ex.sets > processed + 1 && (
                  <button
                    onClick={() =>
                      onPlanChange({
                        ...plan,
                        exercises: plan.exercises.map((e) =>
                          e.exerciseId === ex.exerciseId ? { ...e, sets: e.sets - 1 } : e,
                        ),
                      })
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-[11px] font-semibold hover:bg-muted/80 active:scale-95 transition-all"
                    aria-label="Убрать подход"
                  >
                    <Minus className="h-3 w-3" />
                    подход
                  </button>
                )}
                <button
                  onClick={() =>
                    onPlanChange({
                      ...plan,
                      exercises: plan.exercises.map((e) =>
                        e.exerciseId === ex.exerciseId ? { ...e, sets: e.sets + 1 } : e,
                      ),
                    })
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 active:scale-95 transition-all"
                  aria-label="Добавить подход"
                >
                  <Plus className="h-3 w-3" />
                  подход
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add exercise button + controlled ExercisePicker in edit mode */}
      {editMode && (
        <>
          <button
            onClick={() => setAddPickerOpen(true)}
            disabled={isAddingExercise}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 py-4 text-sm font-semibold text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            {isAddingExercise ? "Добавление..." : "Добавить упражнение"}
          </button>
          <ExercisePicker
            exercises={exercises}
            onSelect={handleAddExercise}
            open={addPickerOpen}
            onOpenChange={setAddPickerOpen}
          />
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pb-8">
        <div className="max-w-md mx-auto">
          <Button
            className={cn(
              "glitch-hover w-full min-h-14 h-auto py-3 font-black rounded-2xl transition-all",
              isAllDone ? "text-lg shadow-xl shadow-primary/20" : "text-sm",
            )}
            variant={isAllDone ? "default" : "outline"}
            onClick={onFinish}
            disabled={isFinishing}
          >
            {isFinishing ? "Завершение..." : isAllDone ? "🎉 Завершить тренировку" : "Завершить досрочно"}
          </Button>
        </div>
      </div>
    </div>
  );
}
