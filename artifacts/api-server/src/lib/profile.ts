import { db, appMetaTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

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

async function readMetaNumber(userId: string, key: string): Promise<number | null> {
  const rows = await db
    .select({ value: appMetaTable.value })
    .from(appMetaTable)
    .where(and(eq(appMetaTable.userId, userId), eq(appMetaTable.key, key)))
    .limit(1);
  if (rows.length === 0) return null;
  const n = Number(rows[0]!.value);
  return Number.isFinite(n) ? n : null;
}

async function readMetaString(userId: string, key: string): Promise<string | null> {
  const rows = await db
    .select({ value: appMetaTable.value })
    .from(appMetaTable)
    .where(and(eq(appMetaTable.userId, userId), eq(appMetaTable.key, key)))
    .limit(1);
  return rows.length > 0 ? rows[0]!.value : null;
}

async function writeMetaNumber(userId: string, key: string, value: number): Promise<void> {
  await db
    .insert(appMetaTable)
    .values({ userId, key, value: String(value), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [appMetaTable.userId, appMetaTable.key],
      set: { value: String(value), updatedAt: new Date() },
    });
}

async function writeMetaString(userId: string, key: string, value: string): Promise<void> {
  await db
    .insert(appMetaTable)
    .values({ userId, key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [appMetaTable.userId, appMetaTable.key],
      set: { value, updatedAt: new Date() },
    });
}

async function deleteMeta(userId: string, key: string): Promise<void> {
  await db
    .delete(appMetaTable)
    .where(and(eq(appMetaTable.userId, userId), eq(appMetaTable.key, key)));
}

export async function getProfile(userId: string): Promise<Profile> {
  const [bodyWeightKg, heightCm, sexRaw] = await Promise.all([
    readMetaNumber(userId, BODY_WEIGHT_KEY),
    readMetaNumber(userId, HEIGHT_KEY),
    readMetaString(userId, SEX_KEY),
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

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
  if ("bodyWeightKg" in input) {
    if (input.bodyWeightKg == null) {
      await deleteMeta(userId, BODY_WEIGHT_KEY);
    } else {
      await writeMetaNumber(userId, BODY_WEIGHT_KEY, input.bodyWeightKg);
    }
  }
  if ("heightCm" in input) {
    if (input.heightCm == null) {
      await deleteMeta(userId, HEIGHT_KEY);
    } else {
      await writeMetaNumber(userId, HEIGHT_KEY, input.heightCm);
    }
  }
  if ("sex" in input && input.sex != null) {
    await writeMetaString(userId, SEX_KEY, input.sex);
  }
  return getProfile(userId);
}

/**
 * Confirmed level — the user's last persisted level. Used as the anchor for
 * the multi-level jump penalty in `computeCurrentLevel`. Returns null when no
 * value is persisted yet (first-time bootstrap).
 */
export async function getConfirmedLevel(userId: string): Promise<number | null> {
  const v = await readMetaNumber(userId, CONFIRMED_LEVEL_KEY);
  if (v == null) return null;
  return Math.max(0, Math.floor(v));
}

export async function setConfirmedLevel(userId: string, level: number): Promise<void> {
  await writeMetaNumber(userId, CONFIRMED_LEVEL_KEY, Math.max(0, Math.floor(level)));
}

export const LEVEL_UP_AT_KEY = "level_up_at_v1";

export async function getLevelUpAt(userId: string): Promise<Date | null> {
  const rows = await db
    .select({ value: appMetaTable.value })
    .from(appMetaTable)
    .where(and(eq(appMetaTable.userId, userId), eq(appMetaTable.key, LEVEL_UP_AT_KEY)))
    .limit(1);
  return rows.length > 0 && rows[0]!.value ? new Date(rows[0]!.value) : null;
}

export async function setLevelUpAt(userId: string, ts: Date): Promise<void> {
  await db
    .insert(appMetaTable)
    .values({ userId, key: LEVEL_UP_AT_KEY, value: ts.toISOString(), updatedAt: ts })
    .onConflictDoUpdate({
      target: [appMetaTable.userId, appMetaTable.key],
      set: { value: ts.toISOString(), updatedAt: ts },
    });
}
