import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepperProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  chips?: number[];
  unit?: string;
  formatValue?: (val: number) => string;
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  chips = [],
  unit,
  formatValue = (v) => v.toString(),
}: StepperProps) {
  const handleDec = () => onChange(Math.max(min, value - step));
  const handleInc = () => onChange(Math.min(max, value + step));

  return (
    <div className="space-y-4 w-full">
      <div className="text-center font-medium text-muted-foreground uppercase tracking-normal text-xs">{label}</div>
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border p-2 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-16 w-16 rounded-xl shrink-0 active:scale-95 transition-transform"
          onClick={handleDec}
        >
          <Minus className="h-8 w-8" />
        </Button>
        <div className="min-w-0 flex-1 break-words text-center select-none font-bold text-3xl leading-tight tracking-normal">
          {formatValue(value)}
          {unit && <span className="text-lg text-muted-foreground ml-1 font-normal tracking-normal">{unit}</span>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-16 w-16 rounded-xl shrink-0 active:scale-95 transition-transform"
          onClick={handleInc}
        >
          <Plus className="h-8 w-8" />
        </Button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {chips.map((chip) => (
            <Button
              key={chip}
              variant="outline"
              size="sm"
              className="h-10 px-4 rounded-full font-bold active:scale-95 transition-transform"
              onClick={() => onChange(chip)}
            >
              {formatValue(chip)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
