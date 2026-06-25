/**
 * Shaping del profilo atleta per Nutrizione (fetta 2 della decomposizione di
 * NutritionPageView): tipi riga + mapper da AthleteMemory + merge memory↔modulo
 * per il solver. Logica pura, testabile, senza React.
 */
import type { AthleteMemory, LifestyleActivityClass } from "@/lib/empathy/schemas";
import { mergeNutritionConfigRecords, parseNutritionConfigRecord } from "@/lib/nutrition/resolve-nutrition-diet-day";
import { mergeRoutineConfigRecords } from "@/lib/nutrition/nutrition-module-profile-merge";

export type AthleteNutritionRow = {
  id: string;
  birth_date: string | null;
  sex: string | null;
  diet_type: string | null;
  intolerances: string[] | null;
  allergies: string[] | null;
  food_preferences: string[] | null;
  food_exclusions: string[] | null;
  supplements: string[] | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  lifestyle_activity_class: LifestyleActivityClass | null;
  routine_config: Record<string, unknown> | null;
  nutrition_config: Record<string, unknown> | null;
  supplement_config: Record<string, unknown> | null;
  preferred_meal_count: number | null;
};

export type PhysioRow = {
  athlete_id: string;
  ftp_watts: number | null;
  lt1_watts: number | null;
  lt2_watts: number | null;
  v_lamax: number | null;
  vo2max_ml_min_kg: number | null;
  baseline_hrv_ms?: number | null;
};

export function mapAthleteMemoryToNutritionProfile(memory: AthleteMemory | null | undefined): AthleteNutritionRow | null {
  const profile = memory?.profile;
  if (!profile) return null;
  return {
    id: profile.id,
    birth_date: profile.birthDate ?? null,
    sex: profile.sex ?? null,
    diet_type: profile.dietType ?? null,
    intolerances: profile.intolerances ?? null,
    allergies: profile.allergies ?? null,
    food_preferences: profile.foodPreferences ?? null,
    food_exclusions: profile.foodExclusions ?? null,
    supplements: profile.supplements ?? null,
    height_cm: profile.heightCm ?? null,
    weight_kg: profile.weightKg ?? null,
    body_fat_pct: profile.bodyFatPct ?? null,
    muscle_mass_kg: profile.muscleMassKg ?? null,
    lifestyle_activity_class: profile.lifestyleActivityClass ?? null,
    routine_config: profile.routineConfig ?? null,
    nutrition_config: profile.nutritionConfig ?? null,
    supplement_config: profile.supplementConfig ?? null,
    preferred_meal_count: profile.preferredMealCount ?? null,
  };
}

export function mapAthleteMemoryToPhysio(memory: AthleteMemory | null | undefined): PhysioRow | null {
  const physiology = memory?.physiology;
  if (!physiology) return null;
  return {
    athlete_id: physiology.athleteId,
    ftp_watts: physiology.physiologicalProfile.ftpWatts ?? null,
    lt1_watts: physiology.physiologicalProfile.lt1Watts ?? null,
    lt2_watts: physiology.physiologicalProfile.lt2Watts ?? null,
    v_lamax: physiology.physiologicalProfile.vLamax ?? null,
    vo2max_ml_min_kg: physiology.physiologicalProfile.vo2maxMlMinKg ?? null,
    baseline_hrv_ms: physiology.physiologicalProfile.baselineHrvMs ?? null,
  };
}

/** Memory profile can omit anthropometry while the module row still has DB values; do not let nulls shadow. */
export function mergeNutritionProfileForSolver(mem: AthleteNutritionRow | null, mod: AthleteNutritionRow | null): AthleteNutritionRow | null {
  if (!mem && !mod) return null;
  if (!mem) return mod;
  if (!mod) return mem;
  const memNc = parseNutritionConfigRecord(mem.nutrition_config);
  const modNc = parseNutritionConfigRecord(mod.nutrition_config);
  const nutrition_config =
    Object.keys(memNc).length > 0 && Object.keys(modNc).length > 0
      ? mergeNutritionConfigRecords(memNc, modNc)
      : Object.keys(modNc).length > 0
        ? modNc
        : memNc;
  return {
    ...mod,
    ...mem,
    id: mem.id || mod.id,
    birth_date: mem.birth_date ?? mod.birth_date,
    sex: mem.sex ?? mod.sex,
    diet_type: mem.diet_type ?? mod.diet_type,
    intolerances: mem.intolerances ?? mod.intolerances,
    allergies: mem.allergies ?? mod.allergies,
    food_preferences: mem.food_preferences ?? mod.food_preferences,
    food_exclusions: mem.food_exclusions ?? mod.food_exclusions,
    supplements: mem.supplements ?? mod.supplements,
    height_cm: mem.height_cm ?? mod.height_cm,
    weight_kg: mem.weight_kg ?? mod.weight_kg,
    body_fat_pct: mem.body_fat_pct ?? mod.body_fat_pct,
    muscle_mass_kg: mem.muscle_mass_kg ?? mod.muscle_mass_kg,
    lifestyle_activity_class: mem.lifestyle_activity_class ?? mod.lifestyle_activity_class,
    routine_config: mergeRoutineConfigRecords(mem.routine_config, mod.routine_config),
    nutrition_config,
    supplement_config: mem.supplement_config ?? mod.supplement_config,
  };
}

export function mergePhysioForSolver(mem: PhysioRow | null, mod: PhysioRow | null): PhysioRow | null {
  if (!mem && !mod) return null;
  if (!mem) return mod;
  if (!mod) return mem;
  return {
    ...mod,
    ...mem,
    athlete_id: mem.athlete_id || mod.athlete_id,
    ftp_watts: mem.ftp_watts ?? mod.ftp_watts,
    lt1_watts: mem.lt1_watts ?? mod.lt1_watts,
    lt2_watts: mem.lt2_watts ?? mod.lt2_watts,
    v_lamax: mem.v_lamax ?? mod.v_lamax,
    vo2max_ml_min_kg: mem.vo2max_ml_min_kg ?? mod.vo2max_ml_min_kg,
    baseline_hrv_ms: mem.baseline_hrv_ms ?? mod.baseline_hrv_ms,
  };
}
