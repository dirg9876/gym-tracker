import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, RotateCcw, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRESETS = [60, 90, 120, 180];

interface RestTimerProps {
  defaultSeconds?: number;
}

function beep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // ignore
  }
  try {
    if ("vibrate" in navigator) navigator.vibrate([200, 80, 200]);
  } catch {
    // ignore
  }
}

export function RestTimer({ defaultSeconds = 90 }: RestTimerProps) {
  const [target, setTarget] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (!firedRef.current) {
            firedRef.current = true;
            beep();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  function start(seconds: number) {
    setTarget(seconds);
    setRemaining(seconds);
    setRunning(true);
    firedRef.current = false;
  }

  function reset() {
    setRunning(false);
    setRemaining(0);
    firedRef.current = false;
  }

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = target > 0 ? 1 - remaining / target : 0;
  const isDone = running && remaining === 0;

  return (
    <div className="bg-card p-4 rounded-3xl border border-border shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-normal">
          <Bell className="h-3.5 w-3.5" />
          <span className="min-w-0 break-words">Отдых между подходами</span>
        </div>
        {running && (
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Сбросить таймер"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {running ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-3"
          >
            <div className="relative h-20 flex items-center justify-center">
              <motion.div
                key={isDone ? "done" : "running"}
                animate={
                  isDone
                    ? { scale: [1, 1.08, 1], color: ["#ff3d1a", "#ff3d1a", "#ff3d1a"] }
                    : {}
                }
                transition={isDone ? { duration: 0.7, repeat: Infinity } : {}}
                className={`font-mono text-5xl font-black tabular-nums ${
                  isDone ? "text-primary" : "text-foreground"
                }`}
              >
                {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </motion.div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full ${isDone ? "bg-primary" : "bg-primary/70"}`}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.4, ease: "linear" }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRemaining((r) => r + 15)}
                className="rounded-xl"
              >
                +15с
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRunning((r) => !r)}
                className="rounded-xl"
              >
                {running && remaining > 0 ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => start(target)}
                className="rounded-xl"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-4 gap-2"
          >
            {PRESETS.map((p) => (
              <Button
                key={p}
                variant="secondary"
                onClick={() => start(p)}
                className="rounded-xl min-h-12 h-auto py-2 font-bold"
              >
                {p < 60
                  ? `${p}с`
                  : `${Math.floor(p / 60)}м${p % 60 ? ` ${p % 60}с` : ""}`}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
