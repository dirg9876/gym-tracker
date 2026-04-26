import t0 from "@/assets/levels/tier-0.png";
import t1 from "@/assets/levels/tier-1.png";
import t2 from "@/assets/levels/tier-2.png";
import t3 from "@/assets/levels/tier-3.png";
import t4 from "@/assets/levels/tier-4.png";
import t5 from "@/assets/levels/tier-5.png";
import t6 from "@/assets/levels/tier-6.png";
import t7 from "@/assets/levels/tier-7.png";
import t8 from "@/assets/levels/tier-8.png";

import f0 from "@/assets/levels/tier-0-f.png";
import f1 from "@/assets/levels/tier-1-f.png";
import f2 from "@/assets/levels/tier-2-f.png";
import f3 from "@/assets/levels/tier-3-f.png";
import f4 from "@/assets/levels/tier-4-f.png";
import f5 from "@/assets/levels/tier-5-f.png";
import f6 from "@/assets/levels/tier-6-f.png";
import f7 from "@/assets/levels/tier-7-f.png";
import f8 from "@/assets/levels/tier-8-f.png";

const TIERS_MALE   = [t0, t1, t2, t3, t4, t5, t6, t7, t8];
const TIERS_FEMALE = [f0, f1, f2, f3, f4, f5, f6, f7, f8];

const LEVEL_MODULES = import.meta.glob("@/assets/levels/level-*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const LEVELS_MALE: Record<number, string>   = {};
const LEVELS_FEMALE: Record<number, string> = {};

for (const [path, url] of Object.entries(LEVEL_MODULES)) {
  const mFemale = path.match(/level-(\d+)-f\.png$/);
  if (mFemale) {
    LEVELS_FEMALE[parseInt(mFemale[1], 10)] = url;
    continue;
  }
  const mMale = path.match(/level-(\d+)\.png$/);
  if (mMale) {
    LEVELS_MALE[parseInt(mMale[1], 10)] = url;
  }
}

export function tierImage(tier: number, sex: "male" | "female" = "male"): string {
  const tiers = sex === "female" ? TIERS_FEMALE : TIERS_MALE;
  const idx = Math.max(0, Math.min(tiers.length - 1, tier));
  return tiers[idx];
}

export function levelImage(level: number, tier: number, sex: "male" | "female" = "male"): string {
  if (sex === "female") {
    return LEVELS_FEMALE[level] ?? tierImage(tier, "female");
  }
  return LEVELS_MALE[level] ?? tierImage(tier, "male");
}
