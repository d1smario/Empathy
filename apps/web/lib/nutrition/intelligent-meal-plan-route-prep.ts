import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enrichIntelligentMealPlanRequestWithRaceDay,
  plannedSessionsForRaceFromDbRows,
} from "@/lib/nutrition/enrich-meal-plan-request-race-day";
import {
  filterIntelligentMealPlanRequestFoods,
  readExcludedFdcIds,
  readExcludedFoodLabels,
} from "@/lib/nutrition/meal-plan-profile-food-filter";
import { applyMealSlotRulesToIntelligentMealPlanRequest } from "@/lib/nutrition/meal-slot-food-rules";
import {
  classDenyFragments,
  readExcludedFoodClasses,
  resolveExcludedFdcIdsFromClasses,
} from "@/lib/nutrition/allergen-class-catalog";
import {
  loadWeeklyStapleCountsFromDb,
  mergeWeeklyStapleCounts,
} from "@/lib/nutrition/meal-rotation-week-db";
import { loadMenuFoodPools, menuRotationKeyResolver } from "@/lib/nutrition/v2/menu-food-catalog-db";
import { loadNutritionAthleteProfile } from "@/lib/nutrition/load-nutrition-athlete-profile";
import { reconcileMealPlanSlotsWithDiet } from "@/lib/nutrition/reconcile-meal-plan-slots-with-diet";
import type { IntelligentMealPlanRequest, IntelligentMealPlanRequestSlot } from "@/lib/nutrition/intelligent-meal-plan-types";
import { resolveNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";
import {
  extractPlannedSessionsFromRequest,
  sanitizeAvgPowerW,
} from "@/lib/nutrition/v2/daily-nutrition-requirements";
import { measuredPositive } from "@/lib/nutrition/v2/fueling-from-substrates";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function sanitizeWeeklyStapleCounts(raw: unknown): Record<string, number> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.length > 72) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 21) continue;
    out[k] = Math.min(21, Math.floor(v));
  }
  return Object.keys(out).length ? out : undefined;
}

export type PreparedIntelligentMealPlanContext = {
  request: IntelligentMealPlanRequest;
  athleteId: string;
  planDate: string;
  profileRow: Record<string, unknown> | null;
  dietDay: ReturnType<typeof resolveNutritionDietDay>;
  plannedSessions: Array<{ label: string; avgPowerW: number; durationMin: number }>;
  /** FTP MISURATO in W (`null` = mai misurato: i default li mette il motore V2). */
  ftp: number | null;
  /** Peso MISURATO in kg (`null` = mai misurato: i default li mette il motore V2). */
  weightKg: number | null;
  performanceIntegration?: import("@/lib/nutrition/performance-integration-scaler").NutritionPerformanceIntegrationDials | null;
};

export async function prepareIntelligentMealPlanContext(
  db: SupabaseClient,
  body: Record<string, unknown>,
): Promise<PreparedIntelligentMealPlanContext | { error: string; status: number }> {
  const athleteId = String(body.athleteId ?? "").trim();
  if (!athleteId) return { error: "Missing athleteId", status: 400 };

  const planDate =
    String((body.plan as Record<string, unknown> | undefined)?.planDate ?? "")
      .slice(0, 10) || new Date().toISOString().slice(0, 10);

  const [nutritionProfile, { data: plannedRows }, weeklyFromDb] = await Promise.all([
    // Fonte unica profilo nutrizione: colonne REALI di athlete_profiles + FTP da
    // physiological_profiles + lifestyle da routine_config (le colonne ftp_watts e
    // lifestyle_activity_class NON esistono su athlete_profiles: chiederle lì
    // faceva fallire l'intera select → profilo vuoto → ftp 250 / peso 70 sempre).
    loadNutritionAthleteProfile(db, athleteId),
    db
      .from("planned_workouts")
      .select("duration_minutes, type, notes, tss_target, kcal_target")
      .eq("athlete_id", athleteId)
      .eq("date", planDate),
    // Memoria settimanale server-autorevole: conteggi staple dei giorni GIÀ persistiti
    // nella settimana ISO di planDate (escluso il giorno in rigenerazione). Il catalogo
    // menù (cache di processo, riusato poi da buildMealPlanV2Production) fornisce la
    // rotation key anche per i cibi nuovi che la costante hardcoded non conosce.
    (async () => {
      const menuPools = await loadMenuFoodPools(db);
      return loadWeeklyStapleCountsFromDb(db, athleteId, planDate, {
        resolveRotationKey: menuPools ? menuRotationKeyResolver(menuPools) : undefined,
      });
    })(),
  ]);

  const plan = body.plan as unknown;
  if (!isRecord(plan)) return { error: "Missing plan", status: 400 };

  // Fusione con i conteggi del client (localStorage): MAX per chiave, mai doppio conteggio.
  const weekly = mergeWeeklyStapleCounts(sanitizeWeeklyStapleCounts(plan.weeklyStapleCounts), weeklyFromDb);
  const planMerged: IntelligentMealPlanRequest = {
    ...(plan as IntelligentMealPlanRequest),
    ...(weekly ? { weeklyStapleCounts: weekly } : {}),
  };

  const clientSlots = Array.isArray(planMerged.slots) ? planMerged.slots : [];
  const dailyMealsKcalTotal =
    typeof planMerged.mealPlanSolverMeta?.dailyMealsKcalTotal === "number"
      ? planMerged.mealPlanSolverMeta.dailyMealsKcalTotal
      : clientSlots.reduce((s, sl) => s + (Number.isFinite(sl.targetKcal) ? sl.targetKcal : 0), 0);

  // Forma di `row` INVARIATA per i lettori a valle (route V1/V2, headless leggono
  // ancora row.ftp_watts / row.lifestyle_activity_class oltre a dietDay, diet_type,
  // supplement_config, nutrition_config...): riga athlete_profiles + le due chiavi
  // risolte dalle fonti vere. Profilo inesistente → null, identico a prima.
  const row: Record<string, unknown> | null = nutritionProfile.profile
    ? {
        ...nutritionProfile.profile,
        ftp_watts: nutritionProfile.ftpWatts,
        lifestyle_activity_class: nutritionProfile.lifestyleActivityClass,
      }
    : null;

  const reconciled = reconcileMealPlanSlotsWithDiet({
    planDate,
    nutritionConfig: row?.nutrition_config ?? null,
    routineConfig: row?.routine_config ?? null,
    dailyMealsKcalTotal,
    clientSlots: clientSlots as IntelligentMealPlanRequestSlot[],
    preferredMealCount:
      typeof row?.preferred_meal_count === "number"
        ? row.preferred_meal_count
        : typeof row?.preferred_meal_count === "string"
          ? Number(row.preferred_meal_count)
          : null,
  });

  // Classi allergeniche/intolleranze (globali, da nutrition_config.excluded_food_classes): il
  // catalogo mappa ogni classe su family + diet_exclude di `nutrition_fdc_food_tags`; UNA query
  // (paginata) risolve gli fdcId dell'intera FAMIGLIA → confluiscono in `excludedFdcIds` (1b) e i
  // `denyFragments` bilingui nel deny testuale (1c). Nessuna classe → `[]` (nessuna query, invariato).
  const excludedClassKeys = readExcludedFoodClasses(row?.nutrition_config ?? null);
  const classFdcIds =
    excludedClassKeys.length > 0 ? await resolveExcludedFdcIdsFromClasses(db, excludedClassKeys) : [];

  // Esclusioni-cibo per fdcId (globali, da nutrition_config): fonte autorevole = DB, unita a
  // quanto eventualmente già inviato dal client + fdcId risolti dalle classi. Con tutto vuoto il
  // set resta vuoto (nessun effetto).
  const excludedFdcIds = [
    ...new Set([
      ...(Array.isArray(planMerged.excludedFdcIds) ? planMerged.excludedFdcIds : []),
      ...readExcludedFdcIds(row?.nutrition_config ?? null),
      ...classFdcIds,
    ].filter((n) => Number.isFinite(n))),
  ];

  // Etichette dei cibi esclusi dal picker + frasi deny delle classi (DB autorevole): confluiscono
  // nel deny testuale (`foodExclusions` → buildMealPlanFoodDenyFragments), così la
  // composizione/arricchimento pasti le esclude anche quando il request del client è stale. Merge +
  // dedup case-insensitive; niente etichette né classi → invariato (retro-compat).
  const excludedFoodLabels = readExcludedFoodLabels(row?.nutrition_config ?? null);
  const extraFoodExclusions = [...excludedFoodLabels, ...classDenyFragments(excludedClassKeys)];
  const foodExclusions = (() => {
    const base = Array.isArray(planMerged.foodExclusions) ? planMerged.foodExclusions : null;
    if (extraFoodExclusions.length === 0) return planMerged.foodExclusions ?? null;
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of [...(base ?? []), ...extraFoodExclusions]) {
      const s = String(raw).trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  })();

  const planFromDiet: IntelligentMealPlanRequest = {
    ...planMerged,
    athleteId,
    planDate,
    slots: reconciled.slots,
    excludedFdcIds,
    foodExclusions,
    dietType: row?.diet_type != null ? String(row.diet_type) : planMerged.dietType,
    mealPlanSolverMeta: {
      ...planMerged.mealPlanSolverMeta,
      dailyMealsKcalTotal: Math.round(dailyMealsKcalTotal),
      integrationLeverLines: [
        ...(planMerged.mealPlanSolverMeta?.integrationLeverLines ?? []),
        ...(reconciled.rebuiltFromDiet
          ? [`Diet ${reconciled.mealCountMode} pasti (${reconciled.slots.length} slot) da athlete_profiles.`]
          : []),
      ].slice(0, 16),
    },
  };

  const routineConfig =
    row?.routine_config && typeof row.routine_config === "object" && !Array.isArray(row.routine_config)
      ? (row.routine_config as Record<string, unknown>)
      : null;

  const raceSessions = plannedSessionsForRaceFromDbRows(Array.isArray(plannedRows) ? plannedRows : []);
  const withRace = enrichIntelligentMealPlanRequestWithRaceDay({
    request: planFromDiet,
    routineConfig,
    weightKg: row?.weight_kg,
    plannedSessions: raceSessions,
  });

  const request = applyMealSlotRulesToIntelligentMealPlanRequest(filterIntelligentMealPlanRequestFoods(withRace));

  if (request.athleteId !== athleteId) return { error: "athleteId mismatch", status: 400 };
  if (!Array.isArray(request.slots) || request.slots.length < 3 || request.slots.length > 6) {
    return { error: "plan.slots: da 3 a 6 pasti (Profile Diet)", status: 400 };
  }
  if (
    !request.mealPlanSolverMeta ||
    typeof request.mealPlanSolverMeta.dailyMealsKcalTotal !== "number" ||
    !Array.isArray(request.mealPlanSolverMeta.integrationLeverLines)
  ) {
    return { error: "plan.mealPlanSolverMeta obbligatorio", status: 400 };
  }

  const dietDay = resolveNutritionDietDay(row?.nutrition_config ?? null, planDate, {
    preferredMealCount: row?.preferred_meal_count as number | null,
  });

  /**
   * FTP e peso MISURATI (null = mai misurati). Il default del motore lo mette il motore:
   * qui si sostituiva 250 W / 70 kg PRIMA di passarli a valle, e la fascia di capacità
   * intestinale finiva calcolata su un FTP inventato — un atleta senza FTP ma leggero
   * (250/53 = 4,72 W/kg) veniva promosso a «ventre allenato» e riceveva più CHO in seduta
   * senza averlo mai dimostrato. Il default resta solo dove serve un numero per stimare la
   * potenza delle sedute (sotto), dove non decide nulla sulla capacità.
   */
  const ftpMeasuredW = measuredPositive(Number(row?.ftp_watts));
  const weightMeasuredKg = measuredPositive(Number(row?.weight_kg));
  const ftp = ftpMeasuredW ?? 250;

  const plannedSessions = (Array.isArray(plannedRows) ? plannedRows : []).map((pr, idx) => {
    const notes = String((pr as Record<string, unknown>).notes ?? "");
    const bs = parsePro2BuilderSessionFromNotes(notes || null);
    const m = resolvePlannedSessionMetrics({
      contract: bs,
      durationMinutesDb: Number((pr as Record<string, unknown>).duration_minutes) || 0,
      tssTargetDb: Number((pr as Record<string, unknown>).tss_target) || 0,
      kcalTargetDb: Number((pr as Record<string, unknown>).kcal_target) || 0,
      athleteFtpWatts: ftp,
    });
    /* Igiene input sulle potenze del Builder: le notes portano a volte medie impossibili
       (746–1.095 W su un atleta senza FTP) che gonfiavano il fueling fino al 308% delle
       kcal della seduta. Oltre la soglia di plausibilità (2×FTP, vedi sanitizeAvgPowerW)
       il dato è marcio e si comporta come una potenza MAI misurata: la seduta resta
       (esiste davvero, la durata è vera), la potenza torna alla stima 0,75×FTP di sempre. */
    const avgPowerPlausibleW = sanitizeAvgPowerW(m.avgPowerW, ftp);
    return {
      label: `${String((pr as Record<string, unknown>).type ?? "session")} #${idx + 1} · ${avgPowerPlausibleW ?? "?"}W · ${m.durationMinutes}min`,
      avgPowerW: avgPowerPlausibleW ?? Math.round(ftp * 0.75),
      durationMin: m.durationMinutes,
    };
  });

  const sessions =
    plannedSessions.length > 0 ? plannedSessions : extractPlannedSessionsFromRequest(request, ftp);

  const perfRaw =
    (body.plan as Record<string, unknown> | undefined)?.performanceIntegration ??
    (request as Record<string, unknown>).performanceIntegration;
  const performanceIntegration =
    perfRaw && typeof perfRaw === "object" && !Array.isArray(perfRaw)
      ? (perfRaw as import("@/lib/nutrition/performance-integration-scaler").NutritionPerformanceIntegrationDials)
      : null;

  return {
    request,
    athleteId,
    planDate,
    profileRow: row,
    dietDay,
    plannedSessions: sessions,
    /** MISURATI, `null` se il profilo non li ha: i default li mette il motore V2. */
    ftp: ftpMeasuredW,
    weightKg: weightMeasuredKg,
    performanceIntegration,
  };
}
