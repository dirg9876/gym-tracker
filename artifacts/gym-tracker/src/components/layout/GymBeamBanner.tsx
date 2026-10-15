import gymBeamLogo from "@/assets/gymbeam-logo.png";

interface GymBeamBannerProps {
  onClick?: () => void;
}

/**
 * Stylised header banner: mascot on the right "lifting" the GYM-BEAM title,
 * barbell decoration spans underneath the text, VHS scanline overlay.
 */
export function GymBeamBanner({ onClick }: GymBeamBannerProps) {
  return (
    <button
      onClick={onClick}
      aria-label="На главную"
      className="relative flex items-center h-14 overflow-visible select-none active:opacity-80 transition-opacity"
      style={{ minWidth: 0 }}
    >
      {/* ── Barbell decoration behind text ───────────────────── */}
      <BarbellDecor />

      {/* ── Title ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col leading-none ml-1">
        <span
          className="glitch font-black tracking-tight"
          style={{ fontSize: "clamp(1.25rem, 5vw, 1.6rem)", lineHeight: 1 }}
        >
          GYM<span style={{ color: "hsl(var(--primary))" }}>-BEAM</span>
        </span>
        {/* VHS tape-counter sub-line */}
        <span
          className="font-mono mt-0.5"
          style={{
            fontSize: "6px",
            letterSpacing: "0.4em",
            color: "hsl(var(--primary) / 0.5)",
            lineHeight: 1,
          }}
        >
          ▒▒▒▒▒▒▒▒▒▒▒
        </span>
      </div>

      {/* ── Mascot ────────────────────────────────────────────── */}
      {/* Overflows below the header intentionally — mascot "stands" on the bar */}
      <img
        src={gymBeamLogo}
        alt=""
        aria-hidden
        className="relative z-10 object-contain pointer-events-none"
        style={{
          imageRendering: "pixelated",
          height: "72px",
          width: "72px",
          marginLeft: "4px",
          marginBottom: "-12px",
          filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.3))",
        }}
      />

      {/* ── CRT scanline overlay (very subtle) ───────────────── */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
        }}
      />
    </button>
  );
}

/** SVG barbell: two weight plates connected by a horizontal bar,
 *  spans the full width of the title row, sits just below the text. */
function BarbellDecor() {
  return (
    <svg
      aria-hidden
      className="absolute bottom-2 left-0"
      width="180"
      height="10"
      viewBox="0 0 180 10"
      fill="none"
      style={{ opacity: 0.55 }}
    >
      {/* Left plate stack */}
      <rect x="0"  y="1" width="5" height="8" rx="1" fill="hsl(var(--primary))" />
      <rect x="5"  y="2" width="3" height="6" rx="0.5" fill="hsl(var(--primary) / 0.7)" />
      {/* Bar */}
      <rect x="8" y="4" width="164" height="2" rx="1" fill="hsl(var(--primary) / 0.4)" />
      {/* Right plate stack */}
      <rect x="172" y="2" width="3" height="6" rx="0.5" fill="hsl(var(--primary) / 0.7)" />
      <rect x="175" y="1" width="5" height="8" rx="1" fill="hsl(var(--primary))" />
    </svg>
  );
}
