import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
} from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildDietMealSlotBudgets, type MacroSplitPct } from "@/lib/nutrition/diet-meal-slot-budgets";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import type { ResolvedNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import type { FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";
import { buildNutritionDayModelV2 } from "@/lib/nutrition/v2/nutrition-day-model-v2";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { loadMenuFoodPools } from "@/lib/nutrition/v2/menu-food-catalog-db";
import { FDC_BRANCH_POOL_SPECS } from "@/lib/nutrition/v2/fdc-pool-specs";
import { queryFdcBranchPool } from "@/lib/nutrition/v2/fdc-branch-query";
import type { FdcFoodBrowseFilter } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import { CLASSIFIER_VERSION } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import type { BuildDailyRequirementsInput } from "@/lib/nutrition/v2/daily-nutrition-requirements";
import { bridgeSubstrateFuelingToProtocolMeta } from "@/lib/nutrition/v2/bridge-substrate-fueling-to-protocol";
import {
  buildDayEngineProvenance,
  computeDayEngineDay,
  dayEngineSlotsToDietBudgets,
  resolveDayEngineMode,
  resolveFirstSessionStartMinutes,
  type DayEngineProvenance,
} from "@/lib/nutrition/v2/day-engine-integration";

const DEFAULT_MEAL_TIMES: FlatMealTimes & { snack_evening?: string } = {
  breakfast: "07:30",
  snack_am: "10:30",
  lunch: "13:00",
  snack_pm: "17:00",
  dinner: "20:30",
  snack_evening: "22:00",
};

const DEFAULT_MACRO_SPLIT: MacroSplitPct = { carbs: 50, protein: 25, fat: 25 };

export type MealPlanV2Production = {
  engine: "nutrition_v2";
  algorithmVersion: "nutrition_meal_plan_v2_production";
  taxonomyVersion: string;
  requirements: DailyNutritionRequirementsV2;
  dietMealSlotBudgets: MealPlanV2DietSlotBudget[];
  composedMealPlan: MealPlanV2ComposedSlot[];
  fuelingProtocolMeta?: ReturnType<typeof bridgeSubstrateFuelingToProtocolMeta>;
  /**
   * Report day-engine (classi/quote Mario) — presente quando la modalità non è "off".
   * In shadow è SOLO registrazione (gli slot serviti non cambiano); in on documenta
   * gli slot applicati. Persistito da persist-v2-plan-to-db in
   * nutrition_plan.inputs_provenance.day_engine (canale QA interrogabile via SQL).
   */
  dayEngine?: DayEngineProvenance;
};

export type BuildMealPlanV2ProductionInput = BuildDailyRequirementsInput & {
  request: IntelligentMealPlanRequest;
  dietDay?: ResolvedNutritionDietDay | null;
  mealTimes?: FlatMealTimes & { snack_evening?: string };
  performanceIntegration?: NutritionPerformanceIntegrationDials | null;
  preferredFuelingBrands?: string[];
  /**
   * SOLO per il day-engine (massa magra → Katch-McArdle): NON entra nel fabbisogno V2
   * esistente (requirements resta identico). Assente → day-engine "non applicabile".
   * Accetta string perché le colonne numeric PostgREST possono arrivare come stringa.
   */
  bodyFatPct?: number | string | null;
  /** SOLO per il day-engine: orario prima seduta (tabella §5 mattino/pomeriggio). */
  routineConfig?: Record<string, unknown> | null;
};

/**
 * Pool FDC per dietProfile: catalogo statico, indipendente da atleta e data.
 * Il for-await seriale costava ~13 round-trip Supabase per OGNI generazione
 * (0,7–2,5 s a POST, e la POST parte a ogni primo load della pagina piano —
 * misura live 2026-07). Qui: query in parallelo + memo di processo con TTL.
 * Sicuro: i consumer non mutano i pool (pickCandidate ordina su copia).
 */
const fdcPoolCacheByDietProfile = new Map<string, { at: number; pools: FdcPoolMap }>();
const FDC_POOL_CACHE_TTL_MS = 5 * 60_000;

async function loadFdcPools(
  admin: SupabaseClient,
  dietProfile: DailyNutritionRequirementsV2["dietProfileActive"],
): Promise<FdcPoolMap> {
  const cached = fdcPoolCacheByDietProfile.get(dietProfile);
  if (cached && Date.now() - cached.at < FDC_POOL_CACHE_TTL_MS) {
    return cached.pools;
  }

  const excludeAmino = dietProfile === "low_histamine" ? (["histamine_rich"] as const) : undefined;
  const entries = await Promise.all(
    FDC_BRANCH_POOL_SPECS.map(async (spec) => {
      const filter: FdcFoodBrowseFilter = {
        ...spec.filter,
        dietProfile,
        excludeAminoProfile: excludeAmino ? [...excludeAmino] : undefined,
      };
      const hits = await queryFdcBranchPool(admin, filter);
      return [spec.poolKey, hits] as const;
    }),
  );
  const map: FdcPoolMap = new Map(entries);
  fdcPoolCacheByDietProfile.set(dietProfile, { at: Date.now(), pools: map });
  return map;
}

function mealTimesFromRequest(
  request: IntelligentMealPlanRequest,
  fallback: FlatMealTimes & { snack_evening?: string },
): FlatMealTimes & { snack_evening?: string } {
  const out = { ...fallback };
  for (const s of request.slots) {
    const t = s.scheduledTimeLocal?.trim();
    if (!t) continue;
    const key = s.slot as keyof typeof out;
    if (key in out) out[key] = t;
  }
  if (request.racePreLunch?.lunchTimeLocal) {
    const slot = request.racePreLunch.mealSlot;
    if (slot in out) out[slot as keyof typeof out] = request.racePreLunch.lunchTimeLocal;
  }
  return out;
}

function resolveDietSlots(
  requirements: DailyNutritionRequirementsV2,
  request: IntelligentMealPlanRequest,
  dietDay: ResolvedNutritionDietDay | null | undefined,
  mealTimes: FlatMealTimes & { snack_evening?: string },
): MealPlanV2DietSlotBudget[] {
  let budgets: MealPlanV2DietSlotBudget[];

  if (dietDay?.configured && dietDay.caloricDistribution) {
    const macroSplit = dietDay.dailyMacros ?? DEFAULT_MACRO_SPLIT;
    budgets = buildDietMealSlotBudgets({
      mealCountMode: dietDay.mealCountMode,
      caloricDistribution: dietDay.caloricDistribution,
      dailyKcal: requirements.energy.mealsKcal,
      macroSplit,
      // Macro custom per-pasto dal Profilo Diet: solo gli slot con voce dedicata deviano
      // dallo split globale; null (profilo non personalizzato) → identico a prima.
      macroSplitByMeal: dietDay.mealMacroCustom,
      mealTimes,
    }).map((b) => ({
      key: b.key,
      label: b.label,
      pct: b.pct,
      kcal: b.kcal,
      carbs: b.carbs,
      protein: b.protein,
      fat: b.fat,
    }));
  } else {
    budgets = request.slots.map((s) => ({
      key: s.slot,
      label: s.labelIt,
      pct: 0,
      kcal: s.targetKcal,
      carbs: s.targetCarbsG,
      protein: s.targetProteinG,
      fat: s.targetFatG,
    }));
  }

  if (request.racePostRecovery && request.slots.length > 0) {
    const bySlot = new Map(request.slots.map((s) => [s.slot, s]));
    budgets = budgets.map((b) => {
      const r = bySlot.get(b.key as (typeof request.slots)[number]["slot"]);
      if (!r) return b;
      return {
        ...b,
        kcal: r.targetKcal,
        carbs: r.targetCarbsG,
        protein: r.targetProteinG,
        fat: r.targetFatG,
      };
    });
  }

  return budgets;
}

export async function buildMealPlanV2Production(
  input: BuildMealPlanV2ProductionInput,
  admin: SupabaseClient,
): Promise<MealPlanV2Production> {
  const { requirements } = buildNutritionDayModelV2({
    ...input,
    performanceIntegration: input.performanceIntegration,
  });

  const mealTimes = mealTimesFromRequest(input.request, input.mealTimes ?? DEFAULT_MEAL_TIMES);
  const dietMealSlotBudgets = resolveDietSlots(requirements, input.request, input.dietDay, mealTimes);

  // ── Day-engine (classi/quote giornaliere di Mario) — SHADOW-first ──────────────────
  // Il collegamento avviene QUI, a monte del composer: in "on" gli slot passati al
  // composer diventano quelli del day-engine (stessa forma di sempre); in "shadow" si
  // calcola e si registra soltanto (slot serviti INVARIATI); "off" → nulla di nuovo.
  // QUALSIASI errore nel ramo nuovo → log + comportamento attuale: il day-engine non
  // deve MAI far fallire una generazione.
  let dayEngine: DayEngineProvenance | undefined;
  let composerSlots = dietMealSlotBudgets;
  const dayEngineMode = resolveDayEngineMode(
    process.env as Record<string, string | undefined>,
    input.request.athleteId,
  );
  if (dayEngineMode !== "off") {
    try {
      const computed = computeDayEngineDay({
        mode: dayEngineMode,
        requirements,
        request: input.request,
        dietDay: input.dietDay ?? null,
        /* Il peso su cui il fabbisogno È STATO costruito (default+pavimento del motore già
           applicati): il day-engine deve classificare sullo stesso numero, non su un input
           grezzo che ora può essere null quando il profilo non ha il peso. */
        weightKg: requirements.weightKg,
        bodyFatPct: input.bodyFatPct ?? null,
        lifestyleActivityClass: input.lifestyleActivityClass ?? null,
        firstSessionStartMinutes: resolveFirstSessionStartMinutes({
          routineConfig: input.routineConfig ?? null,
          planDate: input.request.planDate,
          plannedDurationsMin: (input.plannedSessions ?? []).map((s) => s.durationMin),
        }),
      });
      // Guardrail v1: nei giorni gara gli slot restano quelli attuali (pre/post-race
      // hanno override dedicati che il day-engine v1 non modella) — shadow registra.
      const isRaceDay = Boolean(input.request.racePreLunch || input.request.racePostRecovery);
      if (isRaceDay) computed.flags.push("race_day_not_applied");
      const applied =
        dayEngineMode === "on" && computed.applicable && !isRaceDay && computed.slots.length >= 3;
      if (applied) composerSlots = dayEngineSlotsToDietBudgets(computed.slots);
      dayEngine = buildDayEngineProvenance(computed, dietMealSlotBudgets, applied);
    } catch (err) {
      console.error(
        "[nutrition-v2 day-engine] errore non bloccante, servo il piano attuale:",
        err instanceof Error ? err.message : err,
      );
      dayEngine = undefined;
      composerSlots = dietMealSlotBudgets;
    }
  }

  // Catalogo curato DB in parallelo ai pool taggati: fonte primaria dei pool staple;
  // null (tabella vuota/irraggiungibile) → il compose ricade sull'allowlist hardcoded.
  const [pools, menuFoodPools] = await Promise.all([
    loadFdcPools(admin, requirements.dietProfileActive),
    loadMenuFoodPools(admin),
  ]);
  const denyFragments = buildMealPlanFoodDenyFragments(input.request);

  const composedMealPlan = composeMealPlanV2(requirements, composerSlots, pools, {
    denyFragments,
    weeklyStapleCounts: input.request.weeklyStapleCounts,
    suppressedSlots: input.request.suppressedSlots,
    request: input.request,
    menuFoodPools,
  });

  const sessions = requirements.substrateFueling?.sessions ?? [];
  const fuelingProtocolMeta =
    sessions.length > 0 && requirements.substrateFueling
      ? bridgeSubstrateFuelingToProtocolMeta({
          substrateFueling: requirements.substrateFueling,
          durationMin: Math.round(sessions.reduce((m, s) => Math.max(m, s.durationH * 60), 0)),
          preferredBrands: input.preferredFuelingBrands ?? [],
        })
      : undefined;

  return {
    engine: "nutrition_v2",
    algorithmVersion: "nutrition_meal_plan_v2_production",
    taxonomyVersion: CLASSIFIER_VERSION,
    requirements,
    // Slot EFFETTIVAMENTE passati al composer: identici a prima in off/shadow,
    // quelli del day-engine solo quando applied=true (mode on).
    dietMealSlotBudgets: composerSlots,
    composedMealPlan,
    fuelingProtocolMeta,
    dayEngine,
  };
}
