import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListPrograms,
  useDeleteCustomProgram,
  getListProgramsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { CreateProgramDialog } from "@/components/CreateProgramDialog";
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
import {
  ChevronRight,
  Dumbbell,
  Zap,
  Footprints,
  Target,
  Flame,
  ArrowUp,
  ArrowDown,
  Activity,
  Plus,
  Trash2,
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

export function Programs() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListPrograms();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const deleteMutation = useDeleteCustomProgram({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ programId: deleteId });
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full pt-20 text-muted-foreground">Загрузка...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 space-y-6 pb-24">
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Программы</h1>
            <p className="text-sm text-muted-foreground mt-1">Готовые тренировки на силу и массу. Вес подстроен под твой уровень.</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="shrink-0 mt-1 w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {data?.programs.map((p) => (
            <div
              key={p.id}
              className="bg-card rounded-2xl border border-border flex items-center gap-3 overflow-hidden"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setLocation(`/programs/${p.id}`)}
                onKeyDown={(e) => e.key === "Enter" && setLocation(`/programs/${p.id}`)}
                className="flex-1 min-w-0 flex items-center gap-3 p-4 cursor-pointer active:bg-accent transition-colors text-left"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ProgramIcon id={p.id} isCustom={p.isCustom} className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{p.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-mono text-primary">{p.exerciseCount} упражнений</span>
                    {p.isCustom && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Моя
                      </span>
                    )}
                  </div>
                </div>
                {!p.isCustom && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
              {p.isCustom && (
                <button
                  onClick={() => { setDeleteId(p.id); setDeleteName(p.name); }}
                  className="shrink-0 p-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors h-full"
                  aria-label={`Удалить программу ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <CreateProgramDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить программу?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteName}» будет удалена навсегда. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
