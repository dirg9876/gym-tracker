import t0 from "@/assets/levels/tier-0.png";
import t1 from "@/assets/levels/tier-1.png";
import t2 from "@/assets/levels/tier-2.png";
import t3 from "@/assets/levels/tier-3.png";
import t4 from "@/assets/levels/tier-4.png";
import t5 from "@/assets/levels/tier-5.png";
import t6 from "@/assets/levels/tier-6.png";
import t7 from "@/assets/levels/tier-7.png";
import t8 from "@/assets/levels/tier-8.png";

const TIERS = [t0, t1, t2, t3, t4, t5, t6, t7, t8];

const LEVEL_MODULES = import.meta.glob("@/assets/levels/level-*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const LEVELS_BY_NUMBER: Record<number, string> = {};
for (const [path, url] of Object.entries(LEVEL_MODULES)) {
  const m = path.match(/level-(\d+)\.png$/);
  if (m) {
    LEVELS_BY_NUMBER[parseInt(m[1], 10)] = url;
  }
}

export function tierImage(tier: number): string {
  const idx = Math.max(0, Math.min(TIERS.length - 1, tier));
  return TIERS[idx];
}

export function levelImage(level: number, tier: number): string {
  return LEVELS_BY_NUMBER[level] ?? tierImage(tier);
}
