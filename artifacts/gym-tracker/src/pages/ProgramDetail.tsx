import { useLocation, useRoute } from "wouter";
import {
  useGetProgramPlan,
  getGetProgramPlanQueryKey,
  useCreateWorkout,
  getGetActiveWorkoutQueryKey,
  useGetActiveWorkout,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Dumbbell, Activity } from "lucide-react";

const intentLabel: Record<string, { label: string; color: string }> = {
  strength: { label: "Сила", color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  hypertrophy: { label: "Масса", color: "text-primary bg-primary/10 border-primary/30" },
  accessory: { label: "Добивка", color: "text-muted-foreground bg-muted/40 border-border" },
};

const PROGRAM_PLAN_STORAGE_PREFIX = "gym-tracker:program-plan:";

export function ProgramDetail() {
  const [, params] = useRoute("/programs/:id");
  const programId = params?.id ?? "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: plan, isLoading, isError } = useGetProgramPlan(programId, {
    query: {
      queryKey: getGetProgramPlanQueryKey(programId),
      enabled: Boolean(programId),
    },
  });

  const { data: activeWorkoutResponse } = useGetActiveWorkout();
  const activeWorkout = activeWorkoutResponse?.workout;

  const createWorkout = useCreateWorkout({
    mutation: {
      onSuccess: (newWorkout) => {
        if (plan) {
          try {
            localStorage.setItem(
              `${PROGRAM_PLAN_STORAGE_PREFIX}${newWorkout.id}`,
              JSON.stringify(plan),
            );
          } catch {
            // localStorage may be unavailable; not fatal
          }
        }
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        setLocation(`/workout/${newWorkout.id}`);
      },
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full pt-20 text-muted-foreground">Загрузка...</div>
      </AppShell>
    );
  }

  if (isError || !plan) {
    return (
      <AppShell>
        <div className="p-4 pt-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/programs")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          <p className="mt-6 text-muted-foreground">Программа не найдена.</p>
        </div>
      </AppShell>
    );
  }

  const handleStart = () => {
    if (activeWorkout) {
      // Don't apply this program's plan to an unrelated active workout —
      // the user must finish the current one first. Just navigate to it.
      setLocation(`/workout/${activeWorkout.id}`);
      return;
    }
    createWorkout.mutate({ data: { name: plan.name } });
  };

  return (
    <AppShell>
      <div className="p-4 space-y-6 pb-32">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setLocation("/programs")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Программы
        </Button>

        <div className="flex items-start gap-3">
          <div className="text-4xl shrink-0 w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
            {plan.emoji}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{plan.name}</h1>
            <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-3 text-xs text-muted-foreground">
          <span className="font-mono text-primary">LVL {plan.basedOnLevel}</span>{" "}
          <span className="font-semibold text-foreground">{plan.basedOnLevelName}</span> · веса
          подобраны под твой уровень и личные рекорды.
        </div>

        <div className="space-y-3">
          {plan.exercises.map((ex, idx) => {
            const intent = intentLabel[ex.intent] ?? intentLabel.accessory;
            const reps = ex.repsMin === ex.repsMax ? `${ex.repsMin}` : `${ex.repsMin}–${ex.repsMax}`;
            const weight = ex.isBodyweight
              ? "Свой вес"
              : ex.suggestedWeightKg > 0
                ? `${ex.suggestedWeightKg} кг`
                : "—";
            return (
              <div key={`${ex.exerciseId}-${idx}`} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                      <span>#{idx + 1}</span>
                      <span>·</span>
                      <span>{ex.muscleGroup}</span>
                    </div>
                    <div className="font-bold mt-0.5">{ex.name}</div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${intent.color}`}
                  >
                    {intent.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Подходы</div>
                    <div className="text-xl font-black">{ex.sets}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Повторы</div>
                    <div className="text-xl font-black">{reps}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Вес</div>
                    <div className="text-xl font-black">{weight}</div>
                  </div>
                </div>

                {ex.note && (
                  <div className="text-[11px] text-muted-foreground mt-2 italic">{ex.note}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="max-w-md mx-auto">
            <Button
              className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
              onClick={handleStart}
              disabled={createWorkout.isPending}
            >
              {activeWorkout ? (
                <>
                  <Activity className="mr-2 h-5 w-5 animate-pulse" />
                  Открыть текущую тренировку
                </>
              ) : (
                <>
                  <Dumbbell className="mr-2 h-5 w-5" />
                  Начать «{plan.name}»
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
