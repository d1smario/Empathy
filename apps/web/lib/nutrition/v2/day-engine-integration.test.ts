/**
 * Test dell'innesto day-engine (classi/quote Mario) nel percorso V2 — modulo puro:
 *  a. resolver modalità env (off/shadow/on + allowlist csv);
 *  b. fedeltà end-to-end caso Mario (62 kg magra, ratio ≥4, kcalTarget 5880, fueling 430 g);
 *  c. recupero → 3 slot 35/35/30, niente spuntini;
 *  d. selezione tabella §5 da orario prima seduta (08:00 mattino, 15:00 pomeriggio,
 *     ignoto → default POMERIGGIO documentato);
 *  e. leanMass mancante → applicable=false, nessun throw;
 *  f. shadow non muta request/requirements/slot correnti (deep-equal prima/dopo);
 *  g. CHO_fueling > CHO_giorno → clamp a 0 + flag.
 * Tolleranza ±1 g sui casi di fedeltà (stessa convenzione di day-classification-engine.test).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { DailyNutritionRequirementsV2 } from "@empathy/contracts";
import type {
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildDayEngineProvenance,
  computeDayEngineDay,
  dayEngineSlotsToDietBudgets,
  resolveDayEngineMode,
  resolveFirstSessionStartMinutes,
} from "@/lib/nutrition/v2/day-engine-integration";

/** Anthropometria del caso Mario: 77,5 kg × 20% bf → 62,0 kg magra → Katch 1709 kcal. */
const WEIGHT_KG = 77.5;
const BODY_FAT_PCT = 20;

function assertWithin1g(actual: number, expected: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) <= 1,
    `${label}: atteso ${expected} ±1 g, trovato ${actual}`,
  );
}

function makeRequest(slots: IntelligentMealPlanRequestSlot[] = []): IntelligentMealPlanRequest {
  return {
    athleteId: "ath-1",
    planDate: "2026-08-10",
    dietType: null,
    intolerances: null,
    allergies: null,
    foodExclusions: null,
    foodPreferences: null,
    supplements: null,
    aggregateInhibitors: null,
    pathwayTimingLines: [],
    trainingDayLines: [],
    routineDigest: null,
    contextLines: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 0, integrationLeverLines: [] },
    slots,
  };
}

function makeRequestSlot(
  slot: IntelligentMealPlanRequestSlot["slot"],
  scheduledTimeLocal: string,
): IntelligentMealPlanRequestSlot {
  return {
    slot,
    labelIt: "Slot client",
    scheduledTimeLocal,
    targetKcal: 500,
    targetCarbsG: 60,
    targetProteinG: 30,
    targetFatG: 15,
    functionalTargets: [],
    functionalFoodGroups: [],
    foodCandidates: [],
  };
}

function makeRequirements(trainingKcal: number, intraChoG = 0): DailyNutritionRequirementsV2 {
  return {
    athleteId: "ath-1",
    planDate: "2026-08-10",
    algorithmVersion: "nutrition_requirements_v2_production",
    weightKg: WEIGHT_KG,
    strategyKind: "maintenance",
    dietProfileActive: "mediterranean",
    dailyMacroTargetsGPerKg: { choMinGPerKg: 3, choMaxGPerKg: 5, proGPerKg: 1.4, fatGPerKg: 0.9 },
    energy: {
      // bmr/lifestyle di requirements NON sono usati dal day-engine (che ricalcola il
      // modello Katch): qui valori proxy volutamente diversi per dimostrarlo.
      bmrKcal: 1705,
      lifestyleKcal: 341,
      trainingKcal,
      dailyKcal: 1705 + 341 + trainingKcal,
      mealsKcal: 1705 + 341 + Math.round(trainingKcal * 0.4),
      fuelingKcal: Math.round(trainingKcal * 0.6),
      palMultiplier: 1.2,
    },
    ...(intraChoG > 0
      ? {
          substrateFueling: {
            algorithmVersion: "substrate_fueling_v1" as const,
            sessions: [],
            totals: {
              preChoG: 30,
              intraChoG,
              postChoG: 40,
              fuelingKcal: Math.round(intraChoG * 4),
              endogenousFatKcal: 0,
            },
          },
        }
      : {}),
    macros: {
      basal: { choG: 0, proG: 0, fatG: 0 },
      training: { choG: 0, proG: 0, fatG: 0 },
      total: { choG: 0, proG: 0, fatG: 0 },
    },
    substrateRates: [],
    provenance: [],
  };
}

// ── a. resolver modalità ─────────────────────────────────────────────────────────────

// Default "on" (decisione proprietario 8 ago): il generativo è il comportamento
// normale, vale su tutti i percorsi senza dipendere dall'env di due ambienti.
// "shadow" resta disponibile ma va chiesta esplicitamente.
test("resolver (a): default ON senza env, valori sconosciuti → on", () => {
  assert.equal(resolveDayEngineMode({}, "ath-1"), "on");
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_MODE: "banana" }, "ath-1"), "on");
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_MODE: "" }, null), "on");
});

test("resolver (a): shadow va chiesta esplicitamente", () => {
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_MODE: "shadow" }, "ath-1"), "shadow");
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_MODE: " SHADOW " }, null), "shadow");
});

test("resolver (a): off è kill switch globale, vince anche sull'allowlist", () => {
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_MODE: "off" }, "ath-1"), "off");
  assert.equal(
    resolveDayEngineMode(
      { NUTRITION_DAY_ENGINE_MODE: "off", NUTRITION_DAY_ENGINE_ATHLETES: "ath-1" },
      "ath-1",
    ),
    "off",
  );
});

test("resolver (a): on globale (case/spazi insensibile)", () => {
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_MODE: "on" }, "ath-1"), "on");
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_MODE: " ON " }, null), "on");
});

test("resolver (a): allowlist csv con spazi forza on solo per gli id elencati", () => {
  const env = {
    NUTRITION_DAY_ENGINE_MODE: "shadow",
    NUTRITION_DAY_ENGINE_ATHLETES: " ath-1 , b0082091 ,, ",
  };
  assert.equal(resolveDayEngineMode(env, "ath-1"), "on");
  assert.equal(resolveDayEngineMode(env, "b0082091"), "on");
  assert.equal(resolveDayEngineMode(env, "altro"), "shadow");
  assert.equal(resolveDayEngineMode(env, null), "shadow");
  // Allowlist senza MODE: irrilevante, il default è "on" per tutti.
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_ATHLETES: "" }, "ath-1"), "on");
  assert.equal(resolveDayEngineMode({ NUTRITION_DAY_ENGINE_ATHLETES: "ath-1" }, "altro"), "on");
});

// ── b. fedeltà caso Mario ────────────────────────────────────────────────────────────

test("fedeltà (b): 62 kg magra, ratio ≥4, kcalTarget 5880, fueling 430 → PRO 248 / FAT 186 / CHO 778, pasti CHO 348", () => {
  // Katch 1709 + lifestyle moderate 342 + training stimato 4786 = consumo 6837 → ratio 4.0006.
  // strategiaPct 86 (dayTypePct) → kcalTarget = round(6837 × 0.86) = 5880.
  const result = computeDayEngineDay({
    mode: "shadow",
    requirements: makeRequirements(4786, 430),
    request: makeRequest(),
    dietDay: { dayTypePct: 86 },
    weightKg: WEIGHT_KG,
    bodyFatPct: BODY_FAT_PCT,
    lifestyleActivityClass: "moderate",
    firstSessionStartMinutes: 15 * 60,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.dayClass, "pesante");
  assert.ok(result.ratio != null && result.ratio >= 4, `ratio atteso ≥4, trovato ${result.ratio}`);
  assert.equal(result.bmrKcal, 1709);
  assert.equal(result.leanMassKg, 62);
  assert.equal(result.kcalTarget, 5880);
  assert.ok(result.dayTotals, "dayTotals attesi");
  assertWithin1g(result.dayTotals!.proteinG, 248, "PRO giorno (62×4.0)");
  assertWithin1g(result.dayTotals!.fatG, 186, "FAT giorno (62×3.0)");
  assertWithin1g(result.dayTotals!.choG, 778, "CHO giorno (residuo 4.1)");
  assert.equal(result.fuelingChoG, 430);
  assert.ok(result.mealTotals, "mealTotals attesi");
  assertWithin1g(result.mealTotals!.choG, 348, "CHO pasti (778 − 430)");
  assertWithin1g(result.mealTotals!.proteinG, 248, "PRO pasti = PRO giorno");
  assertWithin1g(result.mealTotals!.fatG, 186, "FAT pasti = FAT giorno");

  // Tabella Pesante (pomeriggio, seduta 15:00): 6 slot 22/12/30/10/20/6.
  assert.equal(result.table, "pomeriggio");
  assert.deepEqual(
    result.slots.map((s) => [s.key, s.pct]),
    [
      ["breakfast", 22],
      ["snack_am", 12],
      ["lunch", 30],
      ["snack_pm", 10],
      ["dinner", 20],
      ["snack_evening", 6],
    ],
  );

  // Somma slot = mealTotals (±1 g) per OGNI macro; kcal slot derivate dai macro 4.1/4.1/9.
  const sum = result.slots.reduce(
    (acc, s) => {
      acc.cho += s.choG;
      acc.pro += s.proteinG;
      acc.fat += s.fatG;
      return acc;
    },
    { cho: 0, pro: 0, fat: 0 },
  );
  assertWithin1g(sum.cho, result.mealTotals!.choG, "Σ CHO slot");
  assertWithin1g(sum.pro, result.mealTotals!.proteinG, "Σ PRO slot");
  assertWithin1g(sum.fat, result.mealTotals!.fatG, "Σ FAT slot");
  for (const s of result.slots) {
    const expectedKcal = Math.round(s.choG * 4.1 + s.proteinG * 4.1 + s.fatG * 9);
    assert.equal(s.kcal, expectedKcal, `kcal slot ${s.key} derivate dai macro`);
  }
});

// ── c. recupero ──────────────────────────────────────────────────────────────────────

test("recupero (c): 3 slot 35/35/30, niente spuntini", () => {
  // Katch 1709 + lifestyle 342 + training 0 = 2051 → ratio 1.20 → recupero.
  const result = computeDayEngineDay({
    mode: "shadow",
    requirements: makeRequirements(0),
    request: makeRequest(),
    dietDay: null,
    weightKg: WEIGHT_KG,
    bodyFatPct: BODY_FAT_PCT,
    lifestyleActivityClass: "moderate",
    firstSessionStartMinutes: null,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.dayClass, "recupero");
  assert.equal(result.table, "recupero");
  assert.equal(result.strategiaPct, 100);
  assert.deepEqual(
    result.slots.map((s) => [s.key, s.pct]),
    [
      ["breakfast", 35],
      ["lunch", 35],
      ["dinner", 30],
    ],
  );
  assert.ok(
    result.slots.every((s) => !s.key.startsWith("snack")),
    "nessuno spuntino in recupero",
  );
});

// ── d. selezione tabella ─────────────────────────────────────────────────────────────

test("tabella (d): seduta 08:00 → MATTINO; 15:00 → POMERIGGIO; ignota → default POMERIGGIO + flag", () => {
  // Training 1500 → consumo 3551 → ratio 2.078 → leggero (mattino colazione 25, pomeriggio 20).
  const base = {
    mode: "shadow" as const,
    requirements: makeRequirements(1500),
    request: makeRequest(),
    dietDay: null,
    weightKg: WEIGHT_KG,
    bodyFatPct: BODY_FAT_PCT,
    lifestyleActivityClass: "moderate",
  };

  const mattino = computeDayEngineDay({ ...base, firstSessionStartMinutes: 8 * 60 });
  assert.equal(mattino.dayClass, "leggero");
  assert.equal(mattino.table, "mattino");
  assert.equal(mattino.slots.find((s) => s.key === "breakfast")?.pct, 25);

  const pomeriggio = computeDayEngineDay({ ...base, firstSessionStartMinutes: 15 * 60 });
  assert.equal(pomeriggio.table, "pomeriggio");
  assert.equal(pomeriggio.slots.find((s) => s.key === "breakfast")?.pct, 20);

  const ignoto = computeDayEngineDay({ ...base, firstSessionStartMinutes: null });
  assert.equal(ignoto.table, "pomeriggio", "orario ignoto → default POMERIGGIO documentato");
  assert.ok(ignoto.flags.includes("training_time_unknown_default_pomeriggio"));

  // Leggero: spuntino serale 0% → slot assente (5 slot, non 6).
  assert.equal(mattino.slots.length, 5);
  assert.ok(!mattino.slots.some((s) => s.key === "snack_evening"));
});

test("tabella (d bis): orario prima seduta dalla routine week_plan (2026-08-10 = Mon)", () => {
  const routineConfig = {
    week_plan: { Mon: { has_training: true, training1_start_time: "08:00" } },
  };
  assert.equal(
    resolveFirstSessionStartMinutes({ routineConfig, planDate: "2026-08-10", plannedDurationsMin: [90] }),
    8 * 60,
  );
  assert.equal(
    resolveFirstSessionStartMinutes({ routineConfig: null, planDate: "2026-08-10", plannedDurationsMin: [90] }),
    null,
  );
  // Nessuna seduta pianificata e nessun flag routine → non inferibile.
  assert.equal(
    resolveFirstSessionStartMinutes({ routineConfig: { week_plan: {} }, planDate: "2026-08-10", plannedDurationsMin: [] }),
    null,
  );
});

test("tabella (d ter): routine compilata SENZA orario esplicito → null (mai il 07:00 sintetizzato)", () => {
  // Regressione finding QA: routine_config esiste (has_training o seduta pianificata ≥25')
  // ma training1_start_time manca → l'orario NON è noto: null → il day-engine applica il
  // default POMERIGGIO + flag, NON la tabella MATTINO da un "07:00" inventato.
  assert.equal(
    resolveFirstSessionStartMinutes({
      routineConfig: { week_plan: { Mon: { has_training: true } } },
      planDate: "2026-08-10",
      plannedDurationsMin: [],
    }),
    null,
  );
  // Seduta pianificata ≥25' con week_plan vuoto: stessa cosa (era il caso che sintetizzava 07:00).
  assert.equal(
    resolveFirstSessionStartMinutes({
      routineConfig: { week_plan: {} },
      planDate: "2026-08-10",
      plannedDurationsMin: [90],
    }),
    null,
  );
  // Fallback root ESPLICITO: resta valido (è un orario configurato, non sintetizzato).
  assert.equal(
    resolveFirstSessionStartMinutes({
      routineConfig: { training1_start_time: "06:30", week_plan: { Mon: { has_training: true } } },
      planDate: "2026-08-10",
      plannedDurationsMin: [],
    }),
    6 * 60 + 30,
  );
  // Orario esplicito ma nessuna seduta quel giorno → nessuna "prima seduta": null.
  assert.equal(
    resolveFirstSessionStartMinutes({
      routineConfig: { training1_start_time: "06:30", week_plan: { Mon: {} } },
      planDate: "2026-08-10",
      plannedDurationsMin: [],
    }),
    null,
  );
});

// ── e. leanMass mancante ─────────────────────────────────────────────────────────────

test("leanMass mancante (e): applicable=false, nessun throw, nessuno slot", () => {
  const result = computeDayEngineDay({
    mode: "on",
    requirements: makeRequirements(1500, 100),
    request: makeRequest(),
    dietDay: { dayTypePct: 100 },
    weightKg: WEIGHT_KG,
    bodyFatPct: null, // senza body fat il modello non espone la massa magra
    lifestyleActivityClass: "moderate",
    firstSessionStartMinutes: 8 * 60,
  });
  assert.equal(result.applicable, false);
  assert.equal(result.reason, "lean_mass_missing");
  assert.deepEqual(result.slots, []);
  // La provenance "non applicabile" resta costruibile per il canale shadow.
  const prov = buildDayEngineProvenance(result, [], false);
  assert.equal(prov.applicable, false);
  assert.equal(prov.applied, false);
  assert.equal(prov.reason, "lean_mass_missing");
});

// ── f. shadow non muta gli input ─────────────────────────────────────────────────────

test("shadow (f): request/requirements/slot correnti invariati (deep-equal prima/dopo)", () => {
  const request = makeRequest([makeRequestSlot("breakfast", "06:45")]);
  const requirements = makeRequirements(4786, 430);
  const currentSlots = [
    { key: "breakfast", label: "Colazione", pct: 25, kcal: 800, carbs: 100, protein: 40, fat: 25 },
    { key: "lunch", label: "Pranzo", pct: 40, kcal: 1200, carbs: 150, protein: 60, fat: 35 },
    { key: "dinner", label: "Cena", pct: 35, kcal: 1000, carbs: 120, protein: 55, fat: 30 },
  ];
  const requestBefore = structuredClone(request);
  const requirementsBefore = structuredClone(requirements);
  const currentSlotsBefore = structuredClone(currentSlots);

  const result = computeDayEngineDay({
    mode: "shadow",
    requirements,
    request,
    dietDay: { dayTypePct: 86 },
    weightKg: WEIGHT_KG,
    bodyFatPct: BODY_FAT_PCT,
    lifestyleActivityClass: "moderate",
    firstSessionStartMinutes: 15 * 60,
  });
  const prov = buildDayEngineProvenance(result, currentSlots, false);
  dayEngineSlotsToDietBudgets(result.slots);

  assert.deepEqual(request, requestBefore, "request mutata dal ramo shadow");
  assert.deepEqual(requirements, requirementsBefore, "requirements mutate dal ramo shadow");
  assert.deepEqual(currentSlots, currentSlotsBefore, "slot correnti mutati dal ramo shadow");

  // Orario client: lo slot omologo (breakfast 06:45) viene rispettato, gli altri default.
  assert.equal(result.slots.find((s) => s.key === "breakfast")?.time, "06:45");
  assert.equal(result.slots.find((s) => s.key === "lunch")?.time, "13:00");

  // Confronto compatto: before dai budget correnti, after dal day-engine, delta coerente.
  const breakfastDiff = prov.slots.find((s) => s.key === "breakfast");
  assert.ok(breakfastDiff?.before && breakfastDiff.after);
  assert.equal(
    breakfastDiff!.deltaKcal,
    Math.round(breakfastDiff!.after!.kcal - breakfastDiff!.before!.kcal),
  );
  const snackDiff = prov.slots.find((s) => s.key === "snack_am");
  assert.ok(snackDiff && snackDiff.before === null && snackDiff.after != null);
});

// ── g. clamp fueling ─────────────────────────────────────────────────────────────────

test("clamp (g): CHO fueling > CHO giorno → CHO pasti 0 + flag", () => {
  // Recupero (2051 kcal target): CHO giorno ≈ 219 g, fueling intra 430 g → clamp.
  const result = computeDayEngineDay({
    mode: "shadow",
    requirements: makeRequirements(0, 430),
    request: makeRequest(),
    dietDay: null,
    weightKg: WEIGHT_KG,
    bodyFatPct: BODY_FAT_PCT,
    lifestyleActivityClass: "moderate",
    firstSessionStartMinutes: null,
  });
  assert.equal(result.applicable, true);
  assert.ok(result.dayTotals!.choG < 430, "fixture: CHO giorno sotto il fueling");
  assert.equal(result.mealTotals!.choG, 0);
  assert.ok(result.flags.includes("fueling_cho_exceeds_day_cho_clamped_0"));
  assert.ok(result.slots.every((s) => s.choG === 0));
  // PRO/FAT pasti restano interi (il fueling intra è solo CHO).
  assertWithin1g(result.mealTotals!.proteinG, result.dayTotals!.proteinG, "PRO pasti");
  assertWithin1g(result.mealTotals!.fatG, result.dayTotals!.fatG, "FAT pasti");
});

// ── budget per il composer ───────────────────────────────────────────────────────────

test("budget composer: stessa forma MealPlanV2DietSlotBudget di sempre", () => {
  const result = computeDayEngineDay({
    mode: "on",
    requirements: makeRequirements(4786, 430),
    request: makeRequest(),
    dietDay: { dayTypePct: 86 },
    weightKg: WEIGHT_KG,
    bodyFatPct: BODY_FAT_PCT,
    lifestyleActivityClass: "moderate",
    firstSessionStartMinutes: 15 * 60,
  });
  const budgets = dayEngineSlotsToDietBudgets(result.slots);
  assert.equal(budgets.length, result.slots.length);
  for (const [i, b] of budgets.entries()) {
    const s = result.slots[i]!;
    assert.deepEqual(b, {
      key: s.key,
      label: s.label,
      pct: s.pct,
      kcal: s.kcal,
      carbs: s.choG,
      protein: s.proteinG,
      fat: s.fatG,
    });
  }
});
