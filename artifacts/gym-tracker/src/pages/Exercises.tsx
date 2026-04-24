import { useState, useMemo } from "react";
import { useListExercises, useCreateExercise, useDeleteExercise, getListExercisesQueryKey } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Trash2, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function Exercises() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");

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
      }
    }
  });

  const filtered = useMemo(() => {
    if (!exercises) return [];
    return exercises.filter(e => 
      e.name.toLowerCase().includes(search.toLowerCase()) || 
      e.muscleGroup.toLowerCase().includes(search.toLowerCase())
    );
  }, [exercises, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const ex of filtered) {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
      groups[ex.muscleGroup].push(ex);
    }
    return groups;
  }, [filtered]);

  return (
    <AppShell>
      <div className="p-4 space-y-6">
        <h1 className="text-3xl font-black mt-4">Упражнения</h1>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Поиск..." 
            className="pl-10 h-12 rounded-2xl bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Add new */}
        <div className="bg-card p-4 rounded-3xl border border-border space-y-3">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Новое упражнение</h3>
          <div className="flex gap-2">
            <Input placeholder="Название" value={newName} onChange={e => setNewName(e.target.value)} className="bg-background rounded-xl" />
            <Input placeholder="Группа" value={newGroup} onChange={e => setNewGroup(e.target.value)} className="bg-background rounded-xl w-1/3" />
          </div>
          <Button 
            className="w-full rounded-xl" 
            onClick={() => createExercise.mutate({ data: { name: newName, muscleGroup: newGroup } })}
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
                <h2 className="font-bold text-primary pl-2 uppercase tracking-wider text-sm">{group}</h2>
                <div className="bg-card rounded-3xl border border-border overflow-hidden divide-y divide-border">
                  {list.map(ex => (
                    <div 
                      key={ex.id} 
                      className="flex items-center justify-between p-4 hover:bg-accent transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Prevent navigation if clicking delete
                        if ((e.target as HTMLElement).closest('button')) return;
                        setLocation(`/exercises/${ex.id}`);
                      }}
                    >
                      <span className="font-medium text-lg">{ex.name}</span>
                      <div className="flex items-center gap-2">
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
