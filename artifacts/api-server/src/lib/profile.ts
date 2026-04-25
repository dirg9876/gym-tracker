import { db, appMetaTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const FALLBACK_BODY_WEIGHT_KG = 80;
export const FALLBACK_SEX = "male" as const;

export const BODY_WEIGHT_KEY = "body_weight_kg";
export const HEIGHT_KEY = "height_cm";
export const SEX_KEY = "sex";
export const CONFIRMED_LEVEL_KEY = "confirmed_level_v1";

export const BODY_WEIGHT_MIN = 30;
export const BODY_WEIGHT_MAX = 250;
export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 230;

export type BMICategory = "underweight" | "normal" | "overweight" | "obese";
export type Sex = "male" | "female";

export type Profile = {
  bodyWeightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  bmiCategory: BMICategory | null;
  sex: Sex;
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

async function readMetaString(key: string): Promise<string | null> {
  const rows = await db
    .select({ value: appMetaTable.value })
    .from(appMetaTable)
    .where(eq(appMetaTable.key, key))
    .limit(1);
  return rows.length > 0 ? rows[0]!.value : null;
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

async function writeMetaString(key: string, value: string): Promise<void> {
  await db
    .insert(appMetaTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appMetaTable.key,
      set: { value, updatedAt: new Date() },
    });
}

async function deleteMeta(key: string): Promise<void> {
  await db.delete(appMetaTable).where(eq(appMetaTable.key, key));
}

export async function getProfile(): Promise<Profile> {
  const [bodyWeightKg, heightCm, sexRaw] = await Promise.all([
    readMetaNumber(BODY_WEIGHT_KEY),
    readMetaNumber(HEIGHT_KEY),
    readMetaString(SEX_KEY),
  ]);

  const sex: Sex = sexRaw === "female" ? "female" : "male";

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
    sex,
  };
}

export type UpdateProfileInput = {
  bodyWeightKg?: number | null;
  heightCm?: number | null;
  sex?: Sex | null;
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
  if ("sex" in input && input.sex != null) {
    await writeMetaString(SEX_KEY, input.sex);
  }
  return getProfile();
}

/**
 * Confirmed level — the user's last persisted level. Used as the anchor for
 * the multi-level jump penalty in `computeCurrentLevel`. Returns null when no
 * value is persisted yet (first-time bootstrap).
 */
export async function getConfirmedLevel(): Promise<number | null> {
  const v = await readMetaNumber(CONFIRMED_LEVEL_KEY);
  if (v == null) return null;
  return Math.max(0, Math.floor(v));
}

export async function setConfirmedLevel(level: number): Promise<void> {
  await writeMetaNumber(CONFIRMED_LEVEL_KEY, Math.max(0, Math.floor(level)));
}
