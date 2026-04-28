import { useLocation } from "wouter";
import { useListPrograms } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
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

function ProgramIcon({ id, className }: { id: string; className?: string }) {
  const Icon = PROGRAM_ICON[id] ?? Dumbbell;
  return <Icon className={className} />;
}

export function Programs() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useListPrograms();

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
        <div className="mt-4">
          <h1 className="text-3xl font-black tracking-tight">Программы</h1>
          <p className="text-sm text-muted-foreground mt-1">Готовые тренировки на силу и массу. Вес подстроен под твой уровень.</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {data?.programs.map((p) => (
            <button
              key={p.id}
              onClick={() => setLocation(`/programs/${p.id}`)}
              className="bg-card p-4 rounded-2xl border border-border active:bg-accent transition-colors text-left flex items-center gap-3"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ProgramIcon id={p.id} className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base">{p.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</div>
                <div className="text-[11px] font-mono text-primary mt-1">{p.exerciseCount} упражнений</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
