import { FEMALE_LEVEL_IMAGES, FEMALE_TIER_IMAGES, MALE_LEVEL_IMAGES, MALE_TIER_IMAGES } from "./levelArt.generated";

type Sex = "male" | "female";

export const MALE_PORTRAIT_INSET = 0.06;

export function tierImage(tier: number, sex: Sex = "male"): number {
  const images = sex === "female" ? FEMALE_TIER_IMAGES : MALE_TIER_IMAGES;
  const index = Number.isFinite(tier) ? Math.max(0, Math.min(images.length - 1, Math.trunc(tier))) : 0;
  return images[index];
}

export function levelImage(level: number, tier: number, sex: Sex = "male"): number {
  const images = sex === "female" ? FEMALE_LEVEL_IMAGES : MALE_LEVEL_IMAGES;
  return Number.isInteger(level) && level >= 0 && level < images.length ? images[level] : tierImage(tier, sex);
}
