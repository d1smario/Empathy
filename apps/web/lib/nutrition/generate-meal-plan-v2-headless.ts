import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";
import { loadObservedActiveKcal } from "@/lib/nutrition/load-observed-active-kcal";
import { buildDietMealSlotBudgets, type CaloricDistribution, type MacroSplitPct } from "@/lib/nutrition/diet-meal-slot-budgets";
import { buildIntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-request-builder";
import { prepareIntelligentMealPlanContext } from "@/lib/nutrition/intelligent-meal-plan-route-prep";
import { loadNutritionAthleteProfile } from "@/lib/nutrition/load-nutrition-athlete-profile";
import { resolveNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import { computeDailyHydrationTargetMl } from "@/lib/nutrition/hydration-target";
import { buildMealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { mealRotationStaplesFromComposedItems } from "@/lib/nutrition/v2/fdc-staple-registry";
import { persistV2PlanToDb } from "@/lib/nutrition/v2/persist-v2-plan-to-db";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { mealTimesFromRoutineWeekPlanForDate, type FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";

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
  opts?: {
    tdeeCorrectionFactor?: number;
    /**
     * Memoria settimanale accumulata dal chiamante (loop 7 giorni): conteggi staple
     * (es. carb:pasta) dei giorni già generati, passati al compose per la rotazione.
     * Si FONDE (max per chiave) con quanto letto dal DB in prepare.
     */
    weeklyStapleCounts?: Record<string, number>;
  },
): Promise<
  { ok: true; planId: string; slots: number; staples: string[] } | { ok: false; error: string }
> {
  const [nutritionProfile, { data: plannedRows }, observedActiveKcal] = await Promise.all([
    // Fonte unica profilo nutrizione: ftp_watts da physiological_profiles e lifestyle
    // da routine_config (su athlete_profiles quelle colonne non esistono).
    loadNutritionAthleteProfile(db, athleteId),
    db
      .from("planned_workouts")
      .select("duration_minutes, tss_target, kcal_target, notes")
      .eq("athlete_id", athleteId)
      .eq("date", planDate),
    // Decisione B: consumo attivo REALE del device per il giorno (null se dato assente → stima).
    loadObservedActiveKcal(db, athleteId, planDate),
  ]);

  // Stesse chiavi snake_case di prima per il codice a valle; profilo assente →
  // ftp/lifestyle null, identico a oggi (num(null)=null, typeof null ≠ "string").
  const p: Record<string, unknown> = {
    ...((nutritionProfile.profile ?? {}) as Record<string, unknown>),
    ftp_watts: nutritionProfile.ftpWatts,
    lifestyle_activity_class: nutritionProfile.lifestyleActivityClass,
  };
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
    observedActiveKcal, // Decisione B: se presente, il fabbisogno segue il consumo reale del device
    recoveryStatus: "unknown",
  });
  // Fattore di correzione TDEE «imparato» (ripianificazione settimanale). 1 = neutro.
  const correction = opts?.tdeeCorrectionFactor != null && Number.isFinite(opts.tdeeCorrectionFactor) && opts.tdeeCorrectionFactor > 0
    ? opts.tdeeCorrectionFactor
    : 1;
  const dailyKcal = Math.max(1, Math.round(model.totals.mealsKcal * correction));

  // 2. Budget per slot dal Profilo Diet (con default se non configurato).
  const dietDay = resolveNutritionDietDay(p.nutrition_config ?? null, planDate, { preferredMealCount });
  const mealCountMode = dietDay.mealCountMode || (preferredMealCount ? String(Math.round(preferredMealCount)) : "5");
  // Orari pasto reali dalla Routine dell'atleta per il giorno (stesso reader del path
  // browser): senza il lookup il piano cron nasceva con orari hardcoded. Giorno senza
  // routine configurata → DEFAULT_MEAL_TIMES, comportamento identico a prima.
  const mealTimes = mealTimesFromRoutineWeekPlanForDate(routineConfig, planDate, DEFAULT_MEAL_TIMES);
  const budgets = buildDietMealSlotBudgets({
    mealCountMode,
    caloricDistribution: dietDay.caloricDistribution ?? DEFAULT_DISTRIBUTION,
    dailyKcal,
    macroSplit: dietDay.dailyMacros ?? DEFAULT_MACRO,
    // Macro custom per-pasto (Profile Diet): null → split globale come oggi.
    macroSplitByMeal: dietDay.mealMacroCustom,
    mealTimes,
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
      nutrition_config: asRecord(p.nutrition_config),
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
  const requestWithWeekly =
    opts?.weeklyStapleCounts && Object.keys(opts.weeklyStapleCounts).length > 0
      ? { ...request, weeklyStapleCounts: { ...opts.weeklyStapleCounts } }
      : request;
  const prepared = await prepareIntelligentMealPlanContext(db, { athleteId, plan: requestWithWeekly });
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
      // Cintura: gli orari routine viaggiano già negli slot della request (scheduledTimeLocal),
      // ma passarli anche qui evita il fallback sul default hardcoded del builder.
      mealTimes,
      performanceIntegration: prepared.performanceIntegration ?? null,
      // Solo day-engine (shadow di default): massa magra→Katch + orario prima seduta.
      bodyFatPct: (prepared.profileRow?.body_fat_pct ?? null) as number | string | null,
      routineConfig,
    },
    db,
  );

  // Idratazione: si persiste il target della FORMULA CANONICA (max(2200, peso×33) + extra solo
  // con seduta), la stessa delle superfici Oggi/Nutrizione — prima qui restava il vecchio peso×35.
  // Peso: weight_kg del profilo (nullable, come le superfici) e NON prepared.weightKg che ha
  // fallback 70 per il solver energetico. Durata: somma dei planned_workouts del giorno già letti
  // sopra — questo path server-side genera in anticipo, quindi il pianificato È il contesto
  // training del giorno (l'«effettivo» con gli eseguiti esiste solo lato superfici).
  const hydrationSessionMin = plannedTraining.reduce((sum, s) => sum + Math.max(0, s.durationMinutes), 0);
  const persisted = await persistV2PlanToDb(db, athleteId, planDate, v2, {
    hydrationMlTarget: computeDailyHydrationTargetMl({ weightKg, sessionDurationMin: hydrationSessionMin }).totalMl,
  });
  if (!persisted.ok) return { ok: false, error: `persist: ${persisted.error}` };
  const staples = mealRotationStaplesFromComposedItems(v2.composedMealPlan.flatMap((s) => s.items));
  return { ok: true, planId: persisted.planId, slots: v2.composedMealPlan.length, staples };
}
