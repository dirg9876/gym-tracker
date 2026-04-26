import { useState, useMemo } from "react";
import { Search, Plus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Exercise } from "@workspace/api-client-react";

interface ExercisePickerProps {
  exercises: Exercise[];
  selectedId?: number;
  onSelect: (id: number) => void;
  onCreate?: (name: string, muscleGroup: string) => void;
}

export function ExercisePicker({ exercises, selectedId, onSelect, onCreate }: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const filtered = useMemo(() => {
    return exercises.filter(e => 
      e.name.toLowerCase().includes(search.toLowerCase()) || 
      e.muscleGroup.toLowerCase().includes(search.toLowerCase())
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

  const selectedExercise = exercises.find(e => e.id === selectedId);

  const handleCreate = () => {
    if (newName && newGroup && onCreate) {
      onCreate(newName, newGroup);
      setNewName("");
      setNewGroup("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full min-h-16 h-auto justify-start text-left font-bold text-base rounded-2xl border-2 py-3">
          {selectedExercise ? (
            <div className="flex min-w-0 flex-col items-start w-full leading-tight">
              <span className="min-w-0 break-words">{selectedExercise.name}</span>
              <span className="text-xs font-normal text-muted-foreground break-words">{selectedExercise.muscleGroup}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Выберите упражнение...</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-full h-[85vh] flex flex-col p-0 rounded-t-3xl sm:rounded-3xl border-none">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Упражнение</DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Поиск..." 
              className="pl-9 h-10 rounded-xl bg-muted/50 border-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 pb-20">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="space-y-2">
                <h4 className="break-words font-semibold text-primary text-sm uppercase tracking-normal pl-2">{group}</h4>
                <div className="grid grid-cols-1 gap-2">
                  {list.map(ex => (
                    <Button
                      key={ex.id}
                      variant="ghost"
                      className={`min-h-14 h-auto justify-between rounded-xl text-left px-4 py-2 ${selectedId === ex.id ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-card hover:bg-accent'}`}
                      onClick={() => {
                        onSelect(ex.id);
                        setIsOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 break-words font-medium leading-tight">{ex.name}</span>
                      {selectedId === ex.id && <Check className="h-5 w-5" />}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            
            {onCreate && (
              <div className="pt-4 mt-4 border-t border-border space-y-3">
                <h4 className="font-semibold text-sm">Новое упражнение</h4>
                <Input 
                  placeholder="Название" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                />
                <Input 
                  placeholder="Группа мышц" 
                  value={newGroup} 
                  onChange={(e) => setNewGroup(e.target.value)} 
                />
                <Button className="w-full" onClick={handleCreate} disabled={!newName || !newGroup}>
                  <Plus className="h-4 w-4 mr-2" /> Добавить
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
