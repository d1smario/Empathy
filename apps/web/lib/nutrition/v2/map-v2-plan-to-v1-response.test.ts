/**
 * INVARIANTE «una sola giornata alimentare» (audit 12 ago): il response_payload che la
 * pagina Nutrizione renderizza e le righe meal/meal_item che Oggi legge devono nascere
 * dagli STESSI item, con gli STESSI grammi e le STESSE kcal — slot del day-engine quando
 * applied, legacy altrimenti. Il lato «persistito» nel test è
 * `pendingMealItemRowsFromProduction` (la stessa selezione usata da persistV2PlanToDb).
 *
 * Regressioni coperte:
 *  1. rescale degli item sul target del solver legacy (mediana −44% kcal servite nei
 *     giorni pesanti con day-engine applied);
 *  2. slot del day-engine (es. snack_evening) persistiti ma assenti dal payload, e slot
 *     legacy senza pasto composto trascinati nel payload come rumore a zero item;
 *  3. slot soppressi: marcatore «Fueling in seduta» a 0 kcal in pagina, nessun meal nel DB;
 *  4. segnaposto proteico («Proteina: …») nel payload al posto del cibo concreto persistito;
 *  5. solverBasis.slots = slot-target SERVITI dal composer, non l'eco di request.slots.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { MealPlanV2ComposedSlot, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { attachSolverBasisToAssembled } from "@/lib/nutrition/meal-plan-solver-basis";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { mapV2PlanToV1AssembledCore } from "@/lib/nutrition/v2/map-v2-plan-to-v1-response";
import {
  pendingMealItemRowsFromProduction,
  persistableComposedSlots,
} from "@/lib/nutrition/v2/persist-v2-plan-to-db";

function reqSlot(slot: MealSlotKey, labelIt: string, kcal: number): IntelligentMealPlanRequestSlot {
  return {
    slot,
    labelIt,
    scheduledTimeLocal: "12:00",
    targetKcal: kcal,
    targetCarbsG: Math.round((kcal * 0.5) / 4),
    targetProteinG: Math.round((kcal * 0.25) / 4),
    targetFatG: Math.round((kcal * 0.25) / 9),
    functionalTargets: [],
    functionalFoodGroups: [],
    foodCandidates: [],
  };
}

function makeRequest(
  slots: IntelligentMealPlanRequestSlot[],
  overrides?: Partial<IntelligentMealPlanRequest>,
): IntelligentMealPlanRequest {
  return {
    athleteId: "ath-1",
    planDate: "2026-08-17",
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
    mealPlanSolverMeta: {
      dailyMealsKcalTotal: slots.reduce((s, x) => s + x.targetKcal, 0),
      integrationLeverLines: [],
    },
    slots,
    ...overrides,
  };
}

function composedItem(
  fdcId: number,
  description: string,
  grams: number,
  kcal: number,
  macros: { cho: number; pro: number; fat: number },
): MealPlanV2ComposedSlot["items"][number] {
  return { fdcId, description, grams, kcal, choG: macros.cho, proG: macros.pro, fatG: macros.fat };
}

function composedSlot(
  slot: MealSlotKey,
  labelIt: string,
  targetKcal: number,
  items: MealPlanV2ComposedSlot["items"],
): MealPlanV2ComposedSlot {
  const totals = items.reduce(
    (acc, it) => {
      acc.kcal += it.kcal;
      acc.choG += it.choG;
      acc.proG += it.proG;
      acc.fatG += it.fatG;
      return acc;
    },
    { kcal: 0, choG: 0, proG: 0, fatG: 0 },
  );
  return { slot, labelIt, targetKcal, items, totals };
}

function budget(key: MealSlotKey, label: string, kcal: number): MealPlanV2DietSlotBudget {
  return {
    key,
    label,
    pct: 0,
    kcal,
    carbs: (kcal * 0.5) / 4,
    protein: (kcal * 0.25) / 4,
    fat: (kcal * 0.25) / 9,
  };
}

function makeProduction(
  budgets: MealPlanV2DietSlotBudget[],
  composed: MealPlanV2ComposedSlot[],
): MealPlanV2Production {
  return {
    engine: "nutrition_v2",
    algorithmVersion: "nutrition_meal_plan_v2_production",
    taxonomyVersion: "test",
    // Il mapper legge solo strategyKind/energy/substrateFueling: fixture minimale.
    requirements: {
      strategyKind: "maintain",
      energy: { fuelingKcal: 0 },
    } as unknown as MealPlanV2Production["requirements"],
    dietMealSlotBudgets: budgets,
    composedMealPlan: composed,
  };
}

/** Item «cibo vero» del payload: esclude il marcatore fueling (0 kcal, nessuna composizione). */
function realFoodItems(core: IntelligentMealPlanAssembledCore, slot: MealSlotKey) {
  const s = core.slots.find((x) => x.slot === slot);
  return (s?.items ?? []).filter((it) => it.approxKcal > 0 || Boolean(it.compositionKey));
}

/**
 * L'invariante vera e propria: per ogni slot, il payload e le voci persistibili hanno lo
 * stesso numero di item, la stessa somma kcal e lo stesso legame FDC, nello stesso ordine.
 */
function assertPayloadMatchesPersisted(
  core: IntelligentMealPlanAssembledCore,
  production: MealPlanV2Production,
) {
  const pending = pendingMealItemRowsFromProduction(production);
  const persistedSlots = [...new Set(pending.map((r) => r.slot))].sort();
  const payloadFoodSlots = core.slots
    .map((s) => s.slot as string)
    .filter((slot) => realFoodItems(core, slot as MealSlotKey).length > 0)
    .sort();
  assert.deepEqual(payloadFoodSlots, persistedSlots, "stesso SET di slot con cibo vero");

  for (const slot of persistedSlots) {
    const rows = pending.filter((r) => r.slot === slot);
    const items = realFoodItems(core, slot as MealSlotKey);
    assert.equal(items.length, rows.length, `slot ${slot}: stesso numero di voci`);
    const payloadKcal = items.reduce((s, it) => s + it.approxKcal, 0);
    const persistedKcal = rows.reduce((s, r) => s + r.kcal, 0);
    assert.equal(payloadKcal, persistedKcal, `slot ${slot}: Σ kcal payload = Σ kcal meal_item`);
    items.forEach((it, i) => {
      const row = rows[i]!;
      assert.equal(it.approxKcal, row.kcal, `slot ${slot} #${i}: kcal identiche`);
      if (row.fdcId != null) {
        assert.equal(it.compositionKey, `fdc:${row.fdcId}`, `slot ${slot} #${i}: stesso fdc_id`);
      }
    });
  }
}

// ── Caso 1: day-engine APPLIED — l'uplift arriva al piatto e alla pagina ────────────────
// request.slots = eco del solver LEGACY (4 slot, totali bassi, con snack_am);
// budgets/composed = slot del DAY-ENGINE (snack_evening al posto di snack_am, kcal alte).
test("applied=true: payload = item del day-engine, senza rescale sul target legacy", async () => {
  const legacy = [
    reqSlot("breakfast", "Colazione", 500),
    reqSlot("snack_am", "Spuntino", 200),
    reqSlot("lunch", "Pranzo", 600),
    reqSlot("dinner", "Cena", 450),
  ];
  const request = makeRequest(legacy);
  const budgets = [
    budget("breakfast", "Colazione", 900),
    budget("lunch", "Pranzo", 1100),
    budget("dinner", "Cena", 950),
    budget("snack_evening", "Spuntino serale", 350),
  ];
  const production = makeProduction(budgets, [
    composedSlot("breakfast", "Colazione", 900, [
      composedItem(101, "Fiocchi d'avena", 120, 460, { cho: 80, pro: 16, fat: 8 }),
      composedItem(102, "Yogurt greco", 200, 430, { cho: 10, pro: 20, fat: 10 }),
    ]),
    composedSlot("lunch", "Pranzo", 1100, [
      composedItem(103, "Riso basmati", 180, 640, { cho: 140, pro: 12, fat: 2 }),
      composedItem(104, "Petto di pollo", 180, 300, { cho: 0, pro: 55, fat: 6 }),
      composedItem(105, "Olio extravergine", 15, 135, { cho: 0, pro: 0, fat: 15 }),
    ]),
    composedSlot("dinner", "Cena", 950, [
      composedItem(106, "Salmone", 200, 420, { cho: 0, pro: 42, fat: 26 }),
      composedItem(107, "Patate", 300, 510, { cho: 100, pro: 6, fat: 1 }),
    ]),
    composedSlot("snack_evening", "Spuntino serale", 350, [
      composedItem(108, "Pane e miele", 90, 340, { cho: 70, pro: 6, fat: 2 }),
    ]),
  ]);

  const core = mapV2PlanToV1AssembledCore(production, request);

  // 2) Set di slot: quello SERVITO (snack_evening presente, snack_am assente — non è stato
  //    composto né persistito, quindi non deve comparire nemmeno vuoto).
  assert.deepEqual(
    core.slots.map((s) => s.slot),
    ["breakfast", "lunch", "dinner", "snack_evening"],
  );

  // 1) Niente rescale: la colazione serve 890 kcal (item), NON i 500 del target legacy.
  const breakfastKcal = realFoodItems(core, "breakfast").reduce((s, it) => s + it.approxKcal, 0);
  assert.equal(breakfastKcal, 890);
  const bSlot = core.slots.find((s) => s.slot === "breakfast")!;
  assert.equal(bSlot.targetKcalEcho, 900, "eco target = target day-engine, non legacy");

  assertPayloadMatchesPersisted(core, production);

  // 5) solverBasis = slot-target serviti, non l'eco del request.
  const body = attachSolverBasisToAssembled(core, request);
  assert.deepEqual(
    body.solverBasis.slots.map((s) => [s.slot, s.targetKcal]),
    [["breakfast", 900], ["lunch", 1100], ["dinner", 950], ["snack_evening", 350]],
  );
  assert.equal(body.solverBasis.dailyMealsKcalTotal, 3300, "Σ target = giornata servita");
  assert.ok(!("servedSlotBasis" in body), "campo di transito rimosso dal body finale");

  // L'invariante regge anche DOPO il finalize (nutrienti/rollup non toccano item né kcal).
  const finalized = await finalizeIntelligentMealPlanCore(core, request, {}, { lunchDinnerProteinDedupe: false });
  assertPayloadMatchesPersisted(finalized, production);
});

// ── Caso 2: day-engine NON applied — il legacy è il target giusto e non cambia niente ──
test("applied=false: slot e target legacy, payload = item composti (kcal del composer)", () => {
  const legacy = [
    reqSlot("breakfast", "Colazione", 500),
    reqSlot("lunch", "Pranzo", 700),
    reqSlot("dinner", "Cena", 600),
  ];
  const request = makeRequest(legacy);
  // Non applied: i budget del composer SONO i legacy (stesse chiavi, stessi target).
  const budgets = [
    budget("breakfast", "Colazione", 500),
    budget("lunch", "Pranzo", 700),
    budget("dinner", "Cena", 600),
  ];
  const production = makeProduction(budgets, [
    composedSlot("breakfast", "Colazione", 500, [
      composedItem(201, "Pane integrale", 100, 250, { cho: 48, pro: 8, fat: 2 }),
      composedItem(202, "Ricotta", 120, 240, { cho: 5, pro: 13, fat: 16 }),
    ]),
    composedSlot("lunch", "Pranzo", 700, [
      composedItem(203, "Pasta di semola", 120, 430, { cho: 86, pro: 14, fat: 2 }),
      composedItem(204, "Tonno", 120, 260, { cho: 0, pro: 30, fat: 10 }),
    ]),
    composedSlot("dinner", "Cena", 600, [
      composedItem(205, "Uova", 120, 190, { cho: 1, pro: 15, fat: 13 }),
      composedItem(206, "Patate", 250, 410, { cho: 80, pro: 5, fat: 1 }),
    ]),
  ]);

  const core = mapV2PlanToV1AssembledCore(production, request);
  assert.deepEqual(core.slots.map((s) => s.slot), ["breakfast", "lunch", "dinner"]);
  assertPayloadMatchesPersisted(core, production);

  // solverBasis coincide col legacy (stessi slot, stessi target): per i piani non-applied
  // la pagina continua a mostrare quello che mostrava.
  const body = attachSolverBasisToAssembled(core, request);
  assert.deepEqual(
    body.solverBasis.slots.map((s) => [s.slot, s.targetKcal]),
    [["breakfast", 500], ["lunch", 700], ["dinner", 600]],
  );
});

// ── Caso 3: slot soppresso (finestra training) ──────────────────────────────────────────
test("slot soppresso: marcatore fueling a 0 kcal nel payload, nessun meal persistito", () => {
  const legacy = [
    reqSlot("breakfast", "Colazione", 500),
    reqSlot("snack_am", "Spuntino", 250),
    reqSlot("lunch", "Pranzo", 700),
    reqSlot("dinner", "Cena", 600),
  ];
  const request = makeRequest(legacy, { suppressedSlots: ["snack_am"] });
  const budgets = [
    budget("breakfast", "Colazione", 500),
    budget("snack_am", "Spuntino", 250),
    budget("lunch", "Pranzo", 700),
    budget("dinner", "Cena", 600),
  ];
  const production = makeProduction(budgets, [
    composedSlot("breakfast", "Colazione", 500, [
      composedItem(301, "Fiocchi d'avena", 100, 380, { cho: 66, pro: 13, fat: 7 }),
    ]),
    // Lo slot soppresso esce dal composer SENZA item (l'energia vive nella timeline Fueling).
    composedSlot("snack_am", "Spuntino", 250, []),
    composedSlot("lunch", "Pranzo", 700, [
      composedItem(302, "Riso", 150, 540, { cho: 118, pro: 10, fat: 1 }),
      composedItem(303, "Bresaola", 80, 120, { cho: 0, pro: 26, fat: 2 }),
    ]),
    composedSlot("dinner", "Cena", 600, [
      composedItem(304, "Merluzzo", 220, 180, { cho: 0, pro: 40, fat: 2 }),
      composedItem(305, "Pane", 150, 400, { cho: 80, pro: 12, fat: 3 }),
    ]),
  ]);

  const core = mapV2PlanToV1AssembledCore(production, request);

  // Il marcatore c'è, a 0 kcal: non è cibo, non altera l'invariante.
  const snack = core.slots.find((s) => s.slot === "snack_am");
  assert.ok(snack, "slot soppresso presente nel payload come marcatore");
  assert.equal(snack!.items.length, 1);
  assert.equal(snack!.items[0]!.name, "Fueling in seduta");
  assert.equal(snack!.items[0]!.approxKcal, 0);

  // Lato DB lo slot non viene persistito.
  assert.deepEqual(
    persistableComposedSlots(production).map((s) => s.slot),
    ["breakfast", "lunch", "dinner"],
  );
  assertPayloadMatchesPersisted(core, production);
});

// ── Caso 4: niente segnaposto proteico nel ramo V2 ──────────────────────────────────────
test("finalize V2: la cena mostra il cibo concreto persistito, non «Proteina: …»", async () => {
  const legacy = [
    reqSlot("breakfast", "Colazione", 400),
    reqSlot("lunch", "Pranzo", 700),
    reqSlot("dinner", "Cena", 600),
  ];
  const request = makeRequest(legacy);
  const budgets = [
    budget("breakfast", "Colazione", 400),
    budget("lunch", "Pranzo", 700),
    budget("dinner", "Cena", 600),
  ];
  // Pranzo e cena con la STESSA famiglia proteica (pollo): il dedupe V1 sostituirebbe la
  // voce cena con un segnaposto di famiglia, ma nel DB resta il cibo concreto.
  const production = makeProduction(budgets, [
    composedSlot("breakfast", "Colazione", 400, [
      composedItem(401, "Pane e marmellata", 120, 400, { cho: 80, pro: 8, fat: 4 }),
    ]),
    composedSlot("lunch", "Pranzo", 700, [
      composedItem(402, "Riso", 150, 400, { cho: 88, pro: 8, fat: 1 }),
      composedItem(403, "Petto di pollo", 180, 300, { cho: 0, pro: 55, fat: 6 }),
    ]),
    composedSlot("dinner", "Cena", 600, [
      composedItem(404, "Patate", 200, 340, { cho: 68, pro: 4, fat: 0 }),
      composedItem(405, "Fuso di pollo", 105, 260, { cho: 0, pro: 28, fat: 15 }),
    ]),
  ]);

  const core = mapV2PlanToV1AssembledCore(production, request);
  const finalized = await finalizeIntelligentMealPlanCore(core, request, {}, { lunchDinnerProteinDedupe: false });

  const dinnerNames = finalized.slots.find((s) => s.slot === "dinner")!.items.map((it) => it.name);
  assert.ok(dinnerNames.includes("Fuso di pollo"), "cibo concreto invariato nel payload");
  assert.ok(
    dinnerNames.every((n) => !n.startsWith("Proteina:")),
    "nessun segnaposto di famiglia nel ramo V2",
  );
  assertPayloadMatchesPersisted(finalized, production);

  // Controprova: il comportamento di DEFAULT (ramo V1) resta il dedupe.
  const v1Style = await finalizeIntelligentMealPlanCore(core, request, {});
  const v1DinnerNames = v1Style.slots.find((s) => s.slot === "dinner")!.items.map((it) => it.name);
  assert.ok(
    v1DinnerNames.some((n) => n.startsWith("Proteina:")),
    "senza opt-out il dedupe V1 continua a sostituire (comportamento storico invariato)",
  );
});
