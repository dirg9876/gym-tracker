import { useEffect, useRef, useState } from "react";

interface LevelUpOverlayProps {
  newLevel: number;
  levelName: string;
  onDismiss: () => void;
}

export function LevelUpOverlay({ newLevel, levelName, onDismiss }: LevelUpOverlayProps) {
  const [phase, setPhase] = useState<"in" | "visible" | "out">("in");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const inTimer = setTimeout(() => setPhase("visible"), 50);
    const outTimer = setTimeout(() => setPhase("out"), 2800);
    const dismissTimer = setTimeout(onDismiss, 3200);
    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;

    function drawNoise() {
      if (!canvas || !ctx) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() > 0.92 ? Math.floor(Math.random() * 180) : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = v > 0 ? 90 : 0;
      }
      ctx.putImageData(imageData, 0, 0);
      frameId = requestAnimationFrame(drawNoise);
    }

    drawNoise();
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  function handleTap() {
    setPhase("out");
    setTimeout(onDismiss, 400);
  }

  return (
    <div
      onClick={handleTap}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer select-none"
      style={{
        background: "rgba(0,0,0,0.93)",
        opacity: phase === "in" ? 0 : phase === "visible" ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      {/* TV static noise canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)",
        }}
      />

      {/* VHS tracking noise bar */}
      <div className="level-up-noise-bar absolute pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-8 text-center">
        {/* LEVEL UP stamp */}
        <div
          className="level-up-stamp text-5xl font-black tracking-widest uppercase"
          style={{
            color: "hsl(var(--primary))",
            textShadow:
              "0 0 40px hsl(var(--primary) / 0.9), 3px 3px 0 rgba(0,220,255,0.45), -3px -3px 0 rgba(255,40,0,0.35)",
            fontFamily: "var(--app-font-sans)",
          }}
        >
          LEVEL UP!
        </div>

        {/* Level number — big, glitchy */}
        <div
          className="level-up-number text-9xl font-black leading-none"
          style={{
            color: "hsl(var(--foreground))",
            textShadow: "0 0 60px hsl(var(--primary) / 0.55)",
            fontFamily: "var(--app-font-sans)",
          }}
        >
          {newLevel}
        </div>

        {/* Level name with chromatic aberration */}
        <div
          className="text-2xl font-bold tracking-wide"
          style={{
            color: "hsl(var(--foreground) / 0.92)",
            textShadow:
              "-2px 0 rgba(255,40,0,0.55), 2px 0 rgba(0,220,255,0.55)",
          }}
        >
          {levelName}
        </div>

        <div
          className="text-xs tracking-widest uppercase mt-6"
          style={{ color: "hsl(var(--muted-foreground) / 0.55)" }}
        >
          Нажми, чтобы продолжить
        </div>
      </div>
    </div>
  );
}
