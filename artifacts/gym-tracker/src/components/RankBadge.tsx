import type { SportRank } from "@workspace/api-client-react";

type Variant = "default" | "compact" | "hero";

const TIER_STYLES: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: "bg-zinc-800/60",   text: "text-zinc-400",   border: "border-zinc-600/50"   }, // Без разряда
  1: { bg: "bg-slate-700/60",  text: "text-slate-300",  border: "border-slate-500/50"  }, // Юн III
  2: { bg: "bg-slate-700/60",  text: "text-slate-300",  border: "border-slate-500/50"  }, // Юн II
  3: { bg: "bg-stone-700/60",  text: "text-stone-200",  border: "border-stone-500/50"  }, // Юн I
  4: { bg: "bg-orange-950/70", text: "text-orange-300", border: "border-orange-600/50" }, // III разряд
  5: { bg: "bg-gray-700/60",   text: "text-gray-200",   border: "border-gray-400/50"   }, // II разряд
  6: { bg: "bg-gray-600/60",   text: "text-gray-100",   border: "border-gray-300/50"   }, // I разряд
  7: { bg: "bg-yellow-900/60", text: "text-yellow-300", border: "border-yellow-500/60" }, // КМС
  8: { bg: "bg-yellow-800/70", text: "text-yellow-200", border: "border-yellow-400/70" }, // МС
};

/** Dot separator shown between rank thresholds in the ladder. */
export function RankDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-1">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/** Inline badge showing the rank shortLabel (e.g. "Юн III", "КМС", "МС"). */
export function RankBadge({
  rank,
  variant = "default",
}: {
  rank: SportRank;
  variant?: Variant;
}) {
  const style = TIER_STYLES[rank.tier] ?? TIER_STYLES[0]!;

  if (variant === "hero") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${style.bg} ${style.text} ${style.border}`}
      >
        {rank.label}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <span
        className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border} leading-none`}
      >
        {rank.shortLabel}
      </span>
    );
  }

  return (
    <span
      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border} leading-none`}
    >
      {rank.shortLabel}
    </span>
  );
}
