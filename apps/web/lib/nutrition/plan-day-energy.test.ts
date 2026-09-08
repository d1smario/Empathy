/**
 * UN SOLO TARGET IN CIMA AL PIANO — regressione.
 *
 * In pagina convivevano quattro energie della stessa giornata e nessuna leggeva le altre:
 * il KPI ricalcolato dal browser a ogni apertura (modello energetico diverso da quello del
 * motore), le BASI del piano (`solverBasis.slots`, l'unico target che il motore ha usato
 * davvero), il servito delle card e il servito del DB.
 *
 * Misurato su Milesi (04968274…), giorno 2026-09-08, dati veri di produzione:
 *   · KPI ricalcolato live . . . . 2788 kcal   (BMR 1822 del solver V1 + lifestyle + quota training)
 *   · target del piano . . . . . . 2188 kcal   (Σ `solverBasis.slots.targetKcal`)
 *   · nel piatto (payload) . . . . 1951 kcal   (Σ voci servite, le stesse delle card)
 * Il numero grosso in cima diceva 2788: un target che nessun piatto di quel giorno ha mai
 * inseguito. Questi test bloccano la regola: il target È del piano quando il piano c'è, la
 * stima resta solo come ripiego dichiarato, e il servito si vede accanto col suo nome.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY_ENERGY_DIVERGENCE_THRESHOLD,
  buildPlanWorkspaceRowBases,
  resolvePlanDayEnergy,
  sumLiveEstimateTargets,
  sumPlanBasisTargets,
  sumPlanServedMacros,
  type DayEnergyLiveRow,
  type PlanBasisSlot,
  type PlanDayEnergyPlanLike,
} from "./plan-day-energy";
import type { IntelligentMealPlanItemOut, IntelligentMealPlanSlotOut } from "./intelligent-meal-plan-types";

/** Basi del piano persistito di Milesi, 2026-09-08 (nutrition_plan.response_payload). */
const MILESI_BASIS: PlanBasisSlot[] = [
  { slot: "breakfast", labelIt: "Colazione", scheduledTimeLocal: "07:00", targetKcal: 766, targetCarbsG: 80, targetProteinG: 33.4, targetFatG: 33.4 },
  { slot: "lunch", labelIt: "Pranzo", scheduledTimeLocal: "12:30", targetKcal: 766, targetCarbsG: 80, targetProteinG: 33.4, targetFatG: 33.4 },
  { slot: "dinner", labelIt: "Cena", scheduledTimeLocal: "19:30", targetKcal: 656, targetCarbsG: 68.6, targetProteinG: 28.6, targetFatG: 28.6 },
];

/**
 * Griglia Diet ricalcolata dal browser per lo stesso giorno (mealsKcal 2788 del solver V1,
 * distribuzione Tue 30/35/25/10 su 4 pasti). Ha gli STESSI tre slot del piano più «snack»:
 * è il caso che rendeva invisibile l'ibrido, perché ogni slot delle basi trovava una riga
 * live da cui prendere i numeri.
 */
const MILESI_LIVE_ROWS: DayEnergyLiveRow[] = [
  { key: "breakfast", label: "Colazione", pct: 30, time: "07:30", kcal: 836, carbs: 155, protein: 84, fat: 43 },
  { key: "lunch", label: "Pranzo", pct: 35, time: "13:00", kcal: 976, carbs: 181, protein: 98, fat: 50 },
  { key: "dinner", label: "Cena", pct: 25, time: "20:00", kcal: 697, carbs: 129, protein: 70, fat: 36 },
  { key: "snack_pm", label: "Spuntino", pct: 10, time: "16:30", kcal: 279, carbs: 52, protein: 28, fat: 14 },
];

function item(name: string, kcal: number, carbsG: number, proteinG: number, fatG: number): IntelligentMealPlanItemOut {
  return {
    name,
    portionHint: "",
    functionalBridge: "",
    approxKcal: kcal,
    macroRole: "mixed",
    nutrients: { kcal, carbsG, proteinG, fatG } as IntelligentMealPlanItemOut["nutrients"],
  };
}

function slot(key: IntelligentMealPlanSlotOut["slot"], items: IntelligentMealPlanItemOut[]): IntelligentMealPlanSlotOut {
  return { slot: key, targetKcalEcho: 0, items, slotCoherence: "", slotTimingRationale: "" };
}

/** Voci vere del piano persistito di Milesi, 2026-09-08. */
const MILESI_PLAN: PlanDayEnergyPlanLike = {
  slots: [
    slot("breakfast", [item("Muesli soia kiwi e noci", 593, 79.5, 20.1, 20.3)]),
    slot("lunch", [
      item("Farro", 349, 72.6, 15.1, 2.3),
      item("Manzo magro", 178, 0, 17.5, 11.4),
      item("Peperoni", 31, 7.2, 1.2, 0.4),
      item("Olio EVO", 163, 0, 0, 18.4),
    ]),
    slot("dinner", [
      item("Pollo con zucchine", 222, 1.5, 20.8, 14.5),
      item("Patate", 293, 66.8, 7.9, 0.4),
      item("Olio EVO", 122, 0, 0, 13.8),
    ]),
  ],
  solverBasis: { slots: MILESI_BASIS },
};

test("col piano persistito il target è quello del piano, non il ricalcolo live", () => {
  const day = resolvePlanDayEnergy({ plan: MILESI_PLAN, liveRows: MILESI_LIVE_ROWS });
  assert.equal(day.source, "plan");
  assert.equal(day.target.kcal, 2188);
  assert.notEqual(day.target.kcal, sumLiveEstimateTargets(MILESI_LIVE_ROWS).kcal);
  assert.equal(day.target.carbs, 228.6);
});

test("senza piano il target è la stima live, dichiarata come tale, e non c'è servito", () => {
  const day = resolvePlanDayEnergy({ plan: null, liveRows: MILESI_LIVE_ROWS });
  assert.equal(day.source, "estimate");
  assert.equal(day.target.kcal, 2788);
  assert.equal(day.served, null);
  assert.equal(day.servedDeltaPct, null);
  assert.equal(day.servedDiverges, false);
});

test("basi vuote non passano per «piano»: si torna alla stima", () => {
  const day = resolvePlanDayEnergy({
    plan: { slots: [], solverBasis: { slots: [] } },
    liveRows: MILESI_LIVE_ROWS,
  });
  assert.equal(day.source, "estimate");
  assert.equal(day.target.kcal, 2788);
});

test("il servito è la somma delle voci del piano, le stesse delle card", () => {
  const served = sumPlanServedMacros(MILESI_PLAN);
  assert.ok(served);
  assert.equal(served.kcal, 1951);
  const day = resolvePlanDayEnergy({ plan: MILESI_PLAN, liveRows: MILESI_LIVE_ROWS });
  assert.equal(day.served?.kcal, 1951);
  assert.ok(day.servedDeltaPct != null);
  assert.equal(Math.round(day.servedDeltaPct * 1000) / 10, -10.8);
  assert.equal(day.servedDiverges, true);
});

test("uno scarto sotto il 5% non fa scattare la riga di spiegazione", () => {
  const basis: PlanBasisSlot[] = [
    { slot: "breakfast", labelIt: "Colazione", scheduledTimeLocal: "07:00", targetKcal: 500, targetCarbsG: 60, targetProteinG: 25, targetFatG: 15 },
    { slot: "lunch", labelIt: "Pranzo", scheduledTimeLocal: "13:00", targetKcal: 500, targetCarbsG: 60, targetProteinG: 25, targetFatG: 15 },
  ];
  const plan: PlanDayEnergyPlanLike = {
    slots: [slot("breakfast", [item("A", 490, 60, 25, 15)]), slot("lunch", [item("B", 490, 60, 25, 15)])],
    solverBasis: { slots: basis },
  };
  const day = resolvePlanDayEnergy({ plan, liveRows: [] });
  assert.equal(day.target.kcal, 1000);
  assert.equal(day.served?.kcal, 980);
  assert.equal(day.servedDiverges, false);
  assert.ok(Math.abs(day.servedDeltaPct ?? 1) <= DAY_ENERGY_DIVERGENCE_THRESHOLD);
});

test("pasto senza voci: come la card, l'unico numero disponibile è il target dello slot", () => {
  const plan: PlanDayEnergyPlanLike = {
    slots: [MILESI_PLAN.slots[0], MILESI_PLAN.slots[1]],
    solverBasis: { slots: MILESI_BASIS },
  };
  const served = sumPlanServedMacros(plan);
  // colazione 593 + pranzo 721 + cena senza voci → target 656
  assert.equal(served?.kcal, 593 + 721 + 656);
});

test("le voci nascoste dal coach non contano nel servito", () => {
  const served = sumPlanServedMacros(MILESI_PLAN, (slotKey, index) => !(slotKey === "lunch" && index === 3));
  // via l'olio del pranzo (163 kcal): il pranzo scende a 558
  assert.equal(served?.kcal, 1951 - 163);
});

test("con le basi, OGNI riga pasto viene dal piano — anche gli slot che la griglia live ha", () => {
  const rows = buildPlanWorkspaceRowBases(MILESI_BASIS, MILESI_LIVE_ROWS);
  assert.deepEqual(
    rows.map((r) => [r.key, r.kcal]),
    [
      ["breakfast", 766],
      ["lunch", 766],
      ["dinner", 656],
    ],
  );
  // la riga live esisteva per tutti e tre: prima vinceva lei (836/976/697).
  assert.equal(rows[0].label, "Colazione");
  assert.equal(rows[0].time, "07:00");
  assert.equal(rows.reduce((s, r) => s + r.kcal, 0), 2188);
});

test("senza basi le righe restano quelle della griglia live", () => {
  const rows = buildPlanWorkspaceRowBases(null, MILESI_LIVE_ROWS);
  assert.deepEqual(rows.map((r) => r.kcal), [836, 976, 697, 279]);
});

test("la somma delle basi è quella che il motore ha scritto", () => {
  assert.equal(sumPlanBasisTargets(MILESI_BASIS).kcal, 2188);
  assert.equal(sumPlanBasisTargets([]).kcal, 0);
});
