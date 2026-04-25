import { db, appMetaTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const FALLBACK_BODY_WEIGHT_KG = 80;

export const BODY_WEIGHT_KEY = "body_weight_kg";
export const HEIGHT_KEY = "height_cm";

export const BODY_WEIGHT_MIN = 30;
export const BODY_WEIGHT_MAX = 250;
export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 230;

export type BMICategory = "underweight" | "normal" | "overweight" | "obese";

export type Profile = {
  bodyWeightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  bmiCategory: BMICategory | null;
};

export function classifyBMI(bmi: number): BMICategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function readMetaNumber(key: string): Promise<number | null> {
  const rows = await db
    .select({ value: appMetaTable.value })
    .from(appMetaTable)
    .where(eq(appMetaTable.key, key))
    .limit(1);
  if (rows.length === 0) return null;
  const n = Number(rows[0]!.value);
  return Number.isFinite(n) ? n : null;
}

async function writeMetaNumber(key: string, value: number): Promise<void> {
  await db
    .insert(appMetaTable)
    .values({ key, value: String(value), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appMetaTable.key,
      set: { value: String(value), updatedAt: new Date() },
    });
}

async function deleteMeta(key: string): Promise<void> {
  await db.delete(appMetaTable).where(eq(appMetaTable.key, key));
}

export async function getProfile(): Promise<Profile> {
  const [bodyWeightKg, heightCm] = await Promise.all([
    readMetaNumber(BODY_WEIGHT_KEY),
    readMetaNumber(HEIGHT_KEY),
  ]);

  let bmi: number | null = null;
  let bmiCategory: BMICategory | null = null;
  if (bodyWeightKg != null && heightCm != null && heightCm > 0) {
    const heightM = heightCm / 100;
    const raw = bodyWeightKg / (heightM * heightM);
    bmi = round1(raw);
    bmiCategory = classifyBMI(raw);
  }

  return {
    bodyWeightKg: bodyWeightKg != null ? round2(bodyWeightKg) : null,
    heightCm: heightCm != null ? round2(heightCm) : null,
    bmi,
    bmiCategory,
  };
}

export type UpdateProfileInput = {
  bodyWeightKg?: number | null;
  heightCm?: number | null;
};

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  if ("bodyWeightKg" in input) {
    if (input.bodyWeightKg == null) {
      await deleteMeta(BODY_WEIGHT_KEY);
    } else {
      await writeMetaNumber(BODY_WEIGHT_KEY, input.bodyWeightKg);
    }
  }
  if ("heightCm" in input) {
    if (input.heightCm == null) {
      await deleteMeta(HEIGHT_KEY);
    } else {
      await writeMetaNumber(HEIGHT_KEY, input.heightCm);
    }
  }
  return getProfile();
}
