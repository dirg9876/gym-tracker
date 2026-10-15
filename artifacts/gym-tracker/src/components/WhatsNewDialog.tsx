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

interface WhatsNewDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WhatsNewDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: WhatsNewDialogProps = {}) {
  const { isSignedIn, isLoaded } = useUser();
  const [autoOpen, setAutoOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const seen = localStorage.getItem(CHANGELOG_STORAGE_KEY);
    if (seen !== CURRENT_VERSION) {
      setAutoOpen(true);
    }
  }, [isLoaded, isSignedIn]);

  const effectiveOpen = !!externalOpen || autoOpen;

  function handleClose() {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, CURRENT_VERSION);
    setAutoOpen(false);
    externalOnOpenChange?.(false);
  }

  return (
    <Dialog open={effectiveOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0 border-2 border-primary/40 bg-background">
        {/* VHS-style header */}
        <div className="relative bg-primary/10 px-6 pt-5 pb-4 border-b border-primary/30 overflow-hidden">
          {/* Scanline overlay on header */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 6px)",
            }}
          />
          <DialogHeader className="relative z-10">
            <div className="text-[10px] font-mono text-primary/60 uppercase tracking-widest mb-2">
              ▶ ЗАГРУЗКА СИСТЕМЫ... v{CURRENT_VERSION}
            </div>
            <DialogTitle className="glitch text-lg font-black tracking-wide uppercase leading-tight">
              ЧТО НОВОГО
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Пока ты качался — мы не сидели сложа руки
            </p>
          </DialogHeader>
        </div>

        {/* Entries */}
        <div className="px-5 py-4 flex flex-col gap-3.5 max-h-[55dvh] overflow-y-auto">
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="font-mono text-[10px] font-bold text-primary/70 border border-primary/30 px-1 py-0.5 mt-0.5 shrink-0 leading-none">
                {entry.icon}
              </span>
              <div>
                <p className="text-sm font-bold leading-snug tracking-wide">
                  {entry.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {entry.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-5 pt-1">
          <Button
            className="glitch-hover w-full font-black tracking-widest uppercase"
            onClick={handleClose}
          >
            ПРИНЯТО. РАБОТАЕМ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
