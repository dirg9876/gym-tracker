import { useState } from "react";
import { Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkoutSet } from "@workspace/api-client-react";
import { formatKg } from "@/lib/format";

interface SetCardProps {
  set: WorkoutSet;
  index: number;
  onDelete: () => void;
}

export function SetCard({ set, index, onDelete }: SetCardProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 p-3 rounded-xl">
        <span className="text-sm text-destructive font-medium pl-1">
          Удалить подход {index}?
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-lg"
            onClick={() => setConfirming(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/15 rounded-lg"
            onClick={() => { setConfirming(false); onDelete(); }}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 bg-card p-3 rounded-xl border border-border/50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
          {index}
        </div>
        <div className="min-w-0 break-words font-mono text-base font-bold leading-tight tracking-normal">
          {formatKg(set.weightKg)} <span className="text-muted-foreground text-sm font-sans mx-1">×</span> {set.reps}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
