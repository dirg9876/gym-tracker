import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  useGetProgramPlan,
  getGetProgramPlanQueryKey,
  useCreateWorkout,
  getGetActiveWorkoutQueryKey,
  useGetActiveWorkout,
  useDeleteCustomProgram,
  getListProgramsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditProgramDialog } from "@/components/EditProgramDialog";
import {
  ChevronLeft,
  Dumbbell,
  Activity,
  Zap,
  Footprints,
  Target,
  Flame,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  type LucideIcon,
} from "lucide-react";

const PROGRAM_ICON: Record<string, LucideIcon> = {
  chest: Dumbbell,
  back: Zap,
  legs: Footprints,
  shoulders: Target,
  arms: Flame,
  push: ArrowUp,
  pull: ArrowDown,
  fullbody: Activity,
};

function ProgramIcon({ id, isCustom, className }: { id: string; isCustom: boolean; className?: string }) {
  if (isCustom) return <Zap className={className} />;
  const Icon = PROGRAM_ICON[id] ?? Dumbbell;
  return <Icon className={className} />;
}

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

  const deleteMutation = useDeleteCustomProgram({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        setLocation("/programs");
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
      setLocation(`/workout/${activeWorkout.id}`);
      return;
    }
    createWorkout.mutate({ data: { name: plan.name } });
  };

  return (
    <AppShell>
      <div className="p-4 space-y-6 pb-32">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setLocation("/programs")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Программы
          </Button>
          {plan.isCustom && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditOpen(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Редактировать программу"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Удалить программу"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3">
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ProgramIcon id={plan.id} isCustom={plan.isCustom} className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{plan.name}</h1>
              {plan.isCustom && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Моя
                </span>
              )}
            </div>
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

                <div className="grid grid-cols-3 gap-2 mt-3 min-w-0">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-normal">Подходы</div>
                    <div className="text-xl font-black">{ex.sets}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-normal">Повторы</div>
                    <div className="text-xl font-black">{reps}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-normal">Вес</div>
                    <div className="break-words text-xl font-black leading-tight">{weight}</div>
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
              className="w-full min-h-14 h-auto px-3 py-3 text-sm font-bold rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить программу?</AlertDialogTitle>
            <AlertDialogDescription>
              «{plan.name}» будет удалена навсегда. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ programId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {plan.isCustom && (
        <EditProgramDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          programId={programId}
          initialName={plan.name}
          initialDescription={plan.description}
          initialExercises={plan.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            sets: ex.sets,
            repsMin: ex.repsMin,
            repsMax: ex.repsMax,
            intent: ex.intent,
          }))}
        />
      )}
    </AppShell>
  );
}
