import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCreateCustomProgram,
  useListExercises,
  getListProgramsQueryKey,
  Exercise,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, GripVertical, ChevronDown } from "lucide-react";

type Intent = "strength" | "hypertrophy" | "accessory";

const INTENT_OPTIONS: { value: Intent; label: string }[] = [
  { value: "strength", label: "Сила" },
  { value: "hypertrophy", label: "Масса" },
  { value: "accessory", label: "Добивка" },
];

interface ProgramExerciseRow {
  exerciseId: number;
  name: string;
  muscleGroup: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  intent: Intent;
}

interface ExercisePickerDialogProps {
  exercises: Exercise[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ex: Exercise) => void;
}

function ExercisePickerDialog({ exercises, open, onOpenChange, onSelect }: ExercisePickerDialogProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q),
    );
  }, [exercises, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    for (const ex of filtered) {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
      groups[ex.muscleGroup].push(ex);
    }
    return groups;
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full h-[85vh] flex flex-col p-0 rounded-t-3xl sm:rounded-3xl border-none">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Выберите упражнение</DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              className="pl-9 h-10 rounded-xl bg-muted/50 border-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-5 pb-8">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="space-y-1">
                <h4 className="font-semibold text-primary text-xs uppercase tracking-wider pl-2 pb-1">
                  {group}
                </h4>
                {list.map((ex) => (
                  <button
                    key={ex.id}
                    className="w-full text-left px-4 py-3 rounded-xl bg-card hover:bg-accent transition-colors font-medium text-sm"
                    onClick={() => {
                      onSelect(ex);
                      onOpenChange(false);
                      setSearch("");
                    }}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">Ничего не найдено</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface ExerciseRowEditorProps {
  row: ProgramExerciseRow;
  onChange: (row: ProgramExerciseRow) => void;
  onRemove: () => void;
}

function ExerciseRowEditor({ row, onChange, onRemove }: ExerciseRowEditorProps) {
  const [intentOpen, setIntentOpen] = useState(false);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight break-words">{row.name}</div>
            <div className="text-[11px] text-muted-foreground">{row.muscleGroup}</div>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wide block mb-1">Подходы</label>
          <Input
            type="number"
            min={1}
            max={20}
            value={row.sets}
            onChange={(e) => onChange({ ...row, sets: Math.max(1, Math.min(20, Number(e.target.value))) })}
            className="h-9 text-center font-bold rounded-xl"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wide block mb-1">Мин повт.</label>
          <Input
            type="number"
            min={1}
            value={row.repsMin}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value));
              onChange({ ...row, repsMin: v, repsMax: Math.max(v, row.repsMax) });
            }}
            className="h-9 text-center font-bold rounded-xl"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground tracking-wide block mb-1">Макс повт.</label>
          <Input
            type="number"
            min={row.repsMin}
            value={row.repsMax}
            onChange={(e) => onChange({ ...row, repsMax: Math.max(row.repsMin, Number(e.target.value)) })}
            className="h-9 text-center font-bold rounded-xl"
          />
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIntentOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm font-medium"
        >
          <span>{INTENT_OPTIONS.find((o) => o.value === row.intent)?.label ?? "—"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        {intentOpen && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${row.intent === opt.value ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent"}`}
                onClick={() => {
                  onChange({ ...row, intent: opt.value });
                  setIntentOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CreateProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProgramDialog({ open, onOpenChange }: CreateProgramDialogProps) {
  const queryClient = useQueryClient();
  const { data: allExercises = [] } = useListExercises();
  const createMutation = useCreateCustomProgram({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        onOpenChange(false);
        setName("");
        setDescription("");
        setExercises([]);
      },
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<ProgramExerciseRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAddExercise = (ex: Exercise) => {
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        intent: "hypertrophy",
      },
    ]);
  };

  const handleSave = () => {
    if (!name.trim() || exercises.length === 0) return;
    createMutation.mutate({
      data: {
        name: name.trim(),
        description: description.trim() || undefined,
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          intent: ex.intent,
        })),
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-full h-[92vh] flex flex-col p-0 rounded-t-3xl sm:rounded-3xl border-none">
          <DialogHeader className="p-4 pb-3 border-b">
            <DialogTitle>Новая программа</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4 pb-8">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Название *
                </label>
                <Input
                  placeholder="Например: Грудь и трицепс"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Описание
                </label>
                <Input
                  placeholder="Необязательно"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Упражнения {exercises.length > 0 && `(${exercises.length})`}
                  </label>
                </div>

                <div className="space-y-3">
                  {exercises.map((ex, idx) => (
                    <ExerciseRowEditor
                      key={`${ex.exerciseId}-${idx}`}
                      row={ex}
                      onChange={(updated) =>
                        setExercises((prev) =>
                          prev.map((r, i) => (i === idx ? updated : r)),
                        )
                      }
                      onRemove={() =>
                        setExercises((prev) => prev.filter((_, i) => i !== idx))
                      }
                    />
                  ))}

                  <button
                    onClick={() => setPickerOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Добавить упражнение
                  </button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <Button
              className="w-full h-12 rounded-2xl font-bold text-sm"
              onClick={handleSave}
              disabled={!name.trim() || exercises.length === 0 || createMutation.isPending}
            >
              {createMutation.isPending ? "Сохраняем..." : "Сохранить программу"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExercisePickerDialog
        exercises={allExercises}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddExercise}
      />
    </>
  );
}
