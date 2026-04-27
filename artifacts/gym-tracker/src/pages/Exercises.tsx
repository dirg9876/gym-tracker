import { useState, useMemo } from "react";
import {
  useListExercises,
  useCreateExercise,
  useDeleteExercise,
  useUpdateExercise,
  getListExercisesQueryKey,
  getGetLevelsQueryKey,
  type Equipment,
  type Exercise,
} from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Trash2, ChevronRight, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { EQUIPMENT_OPTIONS, equipmentLabel } from "@/lib/equipment";

export function Exercises() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyMain, setOnlyMain] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newEquipment, setNewEquipment] = useState<Equipment>("other");

  const { data: exercises, isLoading } = useListExercises();

  const createExercise = useCreateExercise({
    mutation: {
      onSuccess: () => {
        setNewName("");
        setNewGroup("");
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
      }
    }
  });

  const deleteExercise = useDeleteExercise({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
      }
    }
  });

  const updateExercise = useUpdateExercise({
    mutation: {
      onMutate: async ({ exerciseId, data }) => {
        const queryKey = getListExercisesQueryKey();
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData<Exercise[]>(queryKey);
        if (previous) {
          queryClient.setQueryData<Exercise[]>(
            queryKey,
            previous.map((ex) =>
              ex.id === exerciseId
                ? {
                    ...ex,
                    ...(data.isMain !== undefined ? { isMain: data.isMain } : {}),
                    ...(data.equipment !== undefined
                      ? { equipment: data.equipment }
                      : {}),
                  }
                : ex,
            ),
          );
        }
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData(getListExercisesQueryKey(), ctx.previous);
        }
        toast.error("Не удалось обновить упражнение");
      },
      onSuccess: (row, vars) => {
        if (vars.data.isMain !== undefined) {
          toast.success(
            row.isMain
              ? `«${row.name}» отмечено как основное`
              : `«${row.name}» больше не основное`,
          );
        } else if (vars.data.equipment !== undefined) {
          toast.success(`Тип «${row.name}» — ${equipmentLabel(row.equipment)}`);
        }
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
      },
    },
  });

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = search.toLowerCase();
    return exercises.filter((e) => {
      if (onlyMain && !e.isMain) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q)
      );
    });
  }, [exercises, search, onlyMain]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const ex of filtered) {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
      groups[ex.muscleGroup].push(ex);
    }
    return groups;
  }, [filtered]);

  const mainCount = exercises?.filter((e) => e.isMain).length ?? 0;

  return (
    <AppShell>
      <div className="p-4 space-y-6">
        <h1 className="text-3xl font-black mt-4">Упражнения</h1>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-start gap-3 text-sm">
          <Star className="h-5 w-5 text-primary mt-0.5 shrink-0 fill-primary/20" />
          <div>
            <div className="font-semibold">Основные упражнения</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              Отметь звёздочкой те упражнения, по которым растёт твой уровень.
              Сейчас отмечено: <span className="font-mono font-bold text-foreground">{mainCount}</span>.
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              className="pl-10 h-12 rounded-2xl bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyMain((v) => !v)}
            aria-pressed={onlyMain}
            className={`w-full min-h-10 rounded-2xl border px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors ${
              onlyMain
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star
              className={`h-4 w-4 ${onlyMain ? "fill-primary" : ""}`}
            />
            Только основные
            <span className="font-mono text-xs opacity-70">({mainCount})</span>
          </button>
        </div>

        {/* Add new */}
        <div className="bg-card p-4 rounded-3xl border border-border space-y-3">
          <h3 className="font-bold text-sm uppercase tracking-normal text-muted-foreground">Новое упражнение</h3>
          <div className="grid grid-cols-1 gap-2">
            <Input placeholder="Название" value={newName} onChange={e => setNewName(e.target.value)} className="bg-background rounded-xl" />
            <Input placeholder="Группа" value={newGroup} onChange={e => setNewGroup(e.target.value)} className="bg-background rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNewEquipment(opt.value)}
                aria-pressed={newEquipment === opt.value}
                className={`text-xs px-2.5 h-8 rounded-lg border transition-colors ${
                  newEquipment === opt.value
                    ? "bg-primary/15 border-primary/40 text-primary font-medium"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.short}
              </button>
            ))}
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={() =>
              createExercise.mutate({
                data: {
                  name: newName,
                  muscleGroup: newGroup,
                  ...(newEquipment !== "other" ? { equipment: newEquipment } : {}),
                },
              })
            }
            disabled={!newName || !newGroup || createExercise.isPending}
          >
            <Plus className="h-4 w-4 mr-2" /> Добавить
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center p-8">Загрузка...</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="space-y-3">
                <h2 className="break-words font-bold text-primary pl-2 uppercase tracking-normal text-sm">{group}</h2>
                <div className="bg-card rounded-3xl border border-border overflow-hidden divide-y divide-border">
                  {list.map(ex => (
                    <div 
                      key={ex.id} 
                      className="flex items-center justify-between p-4 hover:bg-accent transition-colors cursor-pointer"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        setLocation(`/exercises/${ex.id}`);
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={ex.isMain ? "Убрать из основных" : "Сделать основным"}
                          aria-pressed={ex.isMain}
                          className={`h-9 w-9 shrink-0 ${
                            ex.isMain
                              ? "text-primary hover:text-primary"
                              : "text-muted-foreground/40 hover:text-muted-foreground"
                          }`}
                          disabled={updateExercise.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateExercise.mutate({
                              exerciseId: ex.id,
                              data: { isMain: !ex.isMain },
                            });
                          }}
                        >
                          <Star
                            className={`h-5 w-5 ${ex.isMain ? "fill-primary" : ""}`}
                          />
                        </Button>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="min-w-0 break-words font-medium text-lg leading-tight">{ex.name}</span>
                            {ex.isMain && ex.mcKg != null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                                МСМК: {Math.round(ex.mcKg)} кг
                              </span>
                            )}
                          </div>
                          {ex.isCustom ? (
                            <select
                              value={ex.equipment}
                              onChange={(e) => {
                                updateExercise.mutate({
                                  exerciseId: ex.id,
                                  data: { equipment: e.target.value as Equipment },
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 self-start text-[11px] uppercase tracking-normal text-muted-foreground bg-transparent border-none p-0 cursor-pointer hover:text-foreground focus:outline-none focus:text-foreground"
                              aria-label="Тип оборудования"
                              disabled={updateExercise.isPending}
                            >
                              {EQUIPMENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] uppercase tracking-normal text-muted-foreground">
                              {equipmentLabel(ex.equipment)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ex.isCustom && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteExercise.mutate({ exerciseId: ex.id });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
