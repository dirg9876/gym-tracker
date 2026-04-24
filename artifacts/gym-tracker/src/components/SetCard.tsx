import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkoutSet } from "@workspace/api-client-react";
import { formatKg } from "@/lib/format";

interface SetCardProps {
  set: WorkoutSet;
  index: number;
  onDelete: () => void;
}

export function SetCard({ set, index, onDelete }: SetCardProps) {
  return (
    <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border/50">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
          {index}
        </div>
        <div className="font-mono text-lg font-bold tracking-tight">
          {formatKg(set.weightKg)} <span className="text-muted-foreground text-sm font-sans mx-1">×</span> {set.reps}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
