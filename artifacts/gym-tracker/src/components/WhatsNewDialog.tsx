import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CURRENT_VERSION,
  CHANGELOG_STORAGE_KEY,
  CHANGELOG,
} from "@/lib/changelog";

export function WhatsNewDialog() {
  const { isSignedIn, isLoaded } = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const seen = localStorage.getItem(CHANGELOG_STORAGE_KEY);
    if (seen !== CURRENT_VERSION) {
      setOpen(true);
    }
  }, [isLoaded, isSignedIn]);

  function handleClose() {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, CURRENT_VERSION);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
        <div className="bg-primary/10 px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <div className="text-3xl mb-2">🚀</div>
            <DialogTitle className="text-lg font-bold leading-tight">
              Обновление v{CURRENT_VERSION}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Пока ты качался, мы не сидели сложа руки
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-2xl leading-none mt-0.5 shrink-0">
                {entry.icon}
              </span>
              <div>
                <p className="text-sm font-semibold leading-snug">
                  {entry.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {entry.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <Button
            className="w-full"
            onClick={handleClose}
          >
            Понял, поехали 💪
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
