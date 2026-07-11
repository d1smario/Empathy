import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";
import { buildDietMealSlotBudgets, type CaloricDistribution, type MacroSplitPct } from "@/lib/nutrition/diet-meal-slot-budgets";
import { buildIntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-request-builder";
import { prepareIntelligentMealPlanContext } from "@/lib/nutrition/intelligent-meal-plan-route-prep";
import { resolveNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import { buildMealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { persistV2PlanToDb } from "@/lib/nutrition/v2/persist-v2-plan-to-db";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import type { FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";

/** Default deterministici quando il Profilo Diet non definisce distribuzione/macro/orari. */
const DEFAULT_DISTRIBUTION: CaloricDistribution = { breakfast: 25, lunch: 35, dinner: 30, snacks: 10 };
const DEFAULT_MACRO: MacroSplitPct = { carbs: 50, protein: 25, fat: 25 };
const DEFAULT_MEAL_TIMES: FlatMealTimes & { snack_evening?: string } = {
  breakfast: "07:30",
  lunch: "13:00",
  dinner: "20:00",
  snack_am: "10:30",
  snack_pm: "16:30",
  snack_evening: "22:00",
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function strArr(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Genera e persiste il piano nutrizione V2 per (atleta, data) SERVER-SIDE, senza il body ricco
 * del client. Ricostruisce la richiesta dal profilo con lo stesso percorso canonico:
 *   solver energetico (BMR + carico) → budget slot da Profilo Diet → richiesta → V2 → persist.
 * Riusa la pipeline dell'Edge Function generate-meal-plan. Idempotente: persist fa replace per data.
 */
export async function generateAndPersistMealPlanV2(
  db: SupabaseClient,
  athleteId: string,
  planDate: string,
): Promise<{ ok: true; planId: string; slots: number } | { ok: false; error: string }> {
  const [{ data: profile }, { data: plannedRows }] = await Promise.all([
    db
      .from("athlete_profiles")
      .select(
        "birth_date, sex, height_cm, weight_kg, body_fat_pct, ftp_watts, lifestyle_activity_class, " +
          "nutrition_config, routine_config, preferred_meal_count, diet_type, intolerances, allergies, " +
          "food_exclusions, food_preferences, supplements",
      )
      .eq("id", athleteId)
      .maybeSingle(),
    db
      .from("planned_workouts")
      .select("duration_minutes, tss_target, kcal_target, notes")
      .eq("athlete_id", athleteId)
      .eq("date", planDate),
  ]);

  const p = (profile ?? {}) as Record<string, unknown>;
  const ftp = num(p.ftp_watts);
  const weightKg = num(p.weight_kg);
  const preferredMealCount = num(p.preferred_meal_count);
  const routineConfig = asRecord(p.routine_config);

  // 1. Fabbisogno kcal pasti del giorno (deterministico).
  const plannedTraining = (Array.isArray(plannedRows) ? plannedRows : []).map((r) => {
    const rr = r as Record<string, unknown>;
    const bs = parsePro2BuilderSessionFromNotes(typeof rr.notes === "string" ? rr.notes : null);
    return {
      durationMinutes: num(rr.duration_minutes) ?? 0,
      tssTarget: num(rr.tss_target) ?? undefined,
      kcalTarget: num(rr.kcal_target) ?? undefined,
      avgPowerW: bs?.summary?.avgPowerW ?? null,
    };
  });
  const model = computeNutritionDailyEnergyModel({
    athleteId,
    date: planDate,
    birthDate: typeof p.birth_date === "string" ? p.birth_date : null,
    sex: typeof p.sex === "string" ? p.sex : null,
    heightCm: num(p.height_cm),
    weightKg,
    bodyFatPct: num(p.body_fat_pct),
    ftpWatts: ftp,
    vo2maxMlMinKg: null,
    lifestyleActivityClass: typeof p.lifestyle_activity_class === "string" ? p.lifestyle_activity_class : "moderate",
    plannedTraining,
    recoveryStatus: "unknown",
  });
  const dailyKcal = Math.max(1, Math.round(model.totals.mealsKcal));

  // 2. Budget per slot dal Profilo Diet (con default se non configurato).
  const dietDay = resolveNutritionDietDay(p.nutrition_config ?? null, planDate, { preferredMealCount });
  const mealCountMode = dietDay.mealCountMode || (preferredMealCount ? String(Math.round(preferredMealCount)) : "5");
  const budgets = buildDietMealSlotBudgets({
    mealCountMode,
    caloricDistribution: dietDay.caloricDistribution ?? DEFAULT_DISTRIBUTION,
    dailyKcal,
    macroSplit: dietDay.dailyMacros ?? DEFAULT_MACRO,
    mealTimes: DEFAULT_MEAL_TIMES,
  });
  if (budgets.length < 3) return { ok: false, error: `Profilo Diet insufficiente (${budgets.length} slot)` };

  // 3. Richiesta canonica dal builder condiviso col client.
  const request = buildIntelligentMealPlanRequest({
    athleteId,
    planDate,
    profile: {
      diet_type: typeof p.diet_type === "string" ? p.diet_type : null,
      intolerances: strArr(p.intolerances),
      allergies: strArr(p.allergies),
      food_exclusions: strArr(p.food_exclusions),
      food_preferences: strArr(p.food_preferences),
      supplements: strArr(p.supplements),
      routine_config: routineConfig,
      weight_kg: weightKg,
    },
    mealRows: budgets.map((b) => ({
      key: b.key,
      label: b.label,
      kcal: b.kcal,
      carbs: b.carbs,
      protein: b.protein,
      fat: b.fat,
      timeLocal: b.time,
    })),
    mealPathwayBySlot: {},
    contextLines: [],
    pathwayModulation: null,
    trainingDayLines: [],
  });

  // 4. Prepare (food filter + slot rules) → V2 → persist (stessa pipeline dell'Edge Function).
  const prepared = await prepareIntelligentMealPlanContext(db, { athleteId, plan: request });
  if ("error" in prepared) return { ok: false, error: `prepare: ${prepared.error}` };

  const v2 = await buildMealPlanV2Production(
    {
      request: prepared.request,
      weightKg: prepared.weightKg,
      ftpWatts: prepared.ftp,
      lifestyleActivityClass:
        prepared.profileRow?.lifestyle_activity_class != null
          ? String(prepared.profileRow.lifestyle_activity_class)
          : null,
      dietDayMealsScalePct: prepared.dietDay.dayTypePct,
      plannedSessions: prepared.plannedSessions,
      dietDay: prepared.dietDay,
      performanceIntegration: prepared.performanceIntegration ?? null,
    },
    db,
  );

  const persisted = await persistV2PlanToDb(db, athleteId, planDate, v2, {
    hydrationMlTarget: prepared.weightKg != null ? Math.round(prepared.weightKg * 35) : null,
  });
  if (!persisted.ok) return { ok: false, error: `persist: ${persisted.error}` };
  return { ok: true, planId: persisted.planId, slots: v2.composedMealPlan.length };
}
