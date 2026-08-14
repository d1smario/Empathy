import assert from "node:assert/strict";
import test from "node:test";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildDailyNutritionRequirementsV2,
  extractPlannedSessionsFromRequest,
  MAX_PLAUSIBLE_AVG_POWER_FTP_FACTOR,
} from "@/lib/nutrition/v2/daily-nutrition-requirements";

function minimalRequest(overrides?: Partial<IntelligentMealPlanRequest>): IntelligentMealPlanRequest {
  return {
    athleteId: "athlete-test",
    planDate: "2026-06-05",
    dietType: "omnivore",
    intolerances: null,
    allergies: null,
    foodExclusions: null,
    foodPreferences: null,
    supplements: null,
    aggregateInhibitors: null,
    pathwayTimingLines: [],
    trainingDayLines: ["Long ride 4h @ 270w threshold"],
    routineDigest: null,
    contextLines: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 3800, integrationLeverLines: [] },
    slots: [],
    ...overrides,
  };
}

test("load day 70kg: CHO totale > 400g con 4h 270W", () => {
  const req = minimalRequest();
  const r = buildDailyNutritionRequirementsV2({
    request: req,
    weightKg: 70,
    ftpWatts: 313,
    plannedSessions: [{ label: "Ride", avgPowerW: 270, durationMin: 240 }],
    strategyKind: "load",
  });
  assert.equal(r.strategyKind, "load");
  assert.ok(r.macros.total.choG >= 400, `CHO totale ${r.macros.total.choG}`);
  assert.equal(r.dietProfileActive, "omnivore");
  assert.ok(r.substrateRates.length === 1);
  assert.ok(r.substrateFueling != null);
  assert.ok(r.dailyMacroTargetsGPerKg.choMinGPerKg === 8);
  assert.ok(r.energy.mealsKcal + r.energy.fuelingKcal === r.energy.dailyKcal);
  assert.ok(r.energy.fuelingKcal < r.energy.trainingKcal, "fueling CHO-based < training kcal totale");
});

test("lifestyle unificato: energy.lifestyleKcal = solver V1 (niente più scala PAL parallela)", () => {
  const r = buildDailyNutritionRequirementsV2({
    request: minimalRequest(),
    weightKg: 70,
    ftpWatts: 313,
    lifestyleActivityClass: "moderate",
    plannedSessions: [{ label: "Ride", avgPowerW: 270, durationMin: 240 }],
    strategyKind: "load",
  });
  // Solver V1: moderate = +20% BMR (il vecchio PAL 1.40 avrebbe dato +40%).
  assert.equal(r.energy.lifestyleKcal, Math.round(r.energy.bmrKcal * 0.2), "lifestyle = 20% BMR (V1)");
  assert.equal(r.energy.palMultiplier, 1.2, "palMultiplier = moltiplicatore effettivo V1 (1 + pct)");
  assert.ok(
    !r.provenance.some((line) => /\bPAL\b/.test(line)),
    "provenance non cita più il modello PAL rimosso",
  );
  assert.ok(
    r.provenance.some((line) => line.includes("solver V1")),
    "provenance dichiara il solver V1 come fonte lifestyle",
  );
});

test("suppressedSlots senza righe parsabili → NESSUNA seduta inventata, fueling zero", () => {
  // Il vecchio ramo «stima preview» inventava 240 min a 0,86×FTP da soli
  // suppressedSlots/trainingDayLines: 18/108 giorni di riposo con 447–640 g CHO intra.
  const req = minimalRequest({
    trainingDayLines: ["Riposo — finestra allenamento della routine"],
    suppressedSlots: ["snack_am"],
  });
  assert.deepEqual(extractPlannedSessionsFromRequest(req, 250), []);
  const r = buildDailyNutritionRequirementsV2({ request: req, weightKg: 70, ftpWatts: 250 });
  assert.equal(r.substrateRates.length, 0, "nessuna seduta sintetica");
  assert.equal(r.substrateFueling, undefined, "nessun fueling da substrati");
  assert.equal(r.energy.fuelingKcal, 0, "fueling zero su giorno senza training");
  assert.equal(r.energy.trainingKcal, 0, "nessuna kcal training inventata");
});

test("igiene potenze: soglia esatta 2×FTP — 1095 W con FTP 250 scartata, 500 W passa, 501 W no", () => {
  assert.equal(MAX_PLAUSIBLE_AVG_POWER_FTP_FACTOR, 2, "soglia documentata: 2×FTP (500 W col default 250)");
  // Riga marcia (Builder notes reali: 746–1.095 W su atleta senza FTP) → come non parsabile,
  // e SENZA ripiego su seduta finta: niente sessione.
  const marcia = minimalRequest({ trainingDayLines: ["Endurance 2h @ 1095w"] });
  assert.deepEqual(extractPlannedSessionsFromRequest(marcia, 250), []);
  // Bordo superiore incluso: 500 = 2×250 è ancora plausibile (seduta brevissima anaerobica).
  const bordo = minimalRequest({ trainingDayLines: ["Sprint 1h @ 500w"] });
  assert.deepEqual(extractPlannedSessionsFromRequest(bordo, 250), [
    { label: "Sprint 1h @ 500w", avgPowerW: 500, durationMin: 60 },
  ]);
  const oltre = minimalRequest({ trainingDayLines: ["Sprint 1h @ 501w"] });
  assert.deepEqual(extractPlannedSessionsFromRequest(oltre, 250), []);
  // Stessa igiene sul ramo %FTP: 250% FTP è marcio quanto i watt assoluti.
  const pctMarcia = minimalRequest({ trainingDayLines: ["Lavoro 1h @ 250% ftp"] });
  assert.deepEqual(extractPlannedSessionsFromRequest(pctMarcia, 250), []);
});

test("riga sana passa invariata: 4h @ 270w con FTP 313", () => {
  const req = minimalRequest();
  assert.deepEqual(extractPlannedSessionsFromRequest(req, 313), [
    { label: "Long ride 4h @ 270w threshold", avgPowerW: 270, durationMin: 240 },
  ]);
});

test("vegan diet_type → profilo dieta vegan", () => {
  const r = buildDailyNutritionRequirementsV2({
    request: minimalRequest({ dietType: "vegan" }),
    weightKg: 68,
    ftpWatts: 280,
    plannedSessions: [],
    strategyKind: "maintenance",
  });
  assert.equal(r.dietProfileActive, "vegan");
});
