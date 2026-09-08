/**
 * REGOLA 1 di Mario — il pasto pre-gara è FISSO.
 *
 * «Nel giorno di gara il pasto pre-gara è fisso: 3 g/kg di carboidrati da pasta o riso,
 *  15-20 g di olio, grana padano. Quindi NON deve subire l'influenza del generativo che
 *  cerca di integrare una quota proteica.»
 *
 * Tre voci e basta: la quota proteica la porta il grana. Niente proteina scelta dal
 * generativo, niente dolce di riempimento kcal. Il residuo kcal rispetto al budget dello
 * slot Diet NON ristuffa il pasto: va agli altri pasti del giorno.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildRacePreLunchDayContext,
  composeRacePreLunchMainMeal,
  type RacePreLunchDayContext,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";

/** Voci che il generativo aggiungeva e che Mario ha tolto dal protocollo. */
const ADDED_PROTEIN = /pollo|tacchino|pesce|merluzzo|uov|tofu/i;
const KCAL_TOPUP = /crostata|torta|fette biscottate|marmellata/i;

function raceCtxFor(weightKg: number, activeSlots?: readonly ("breakfast" | "lunch" | "dinner" | "snack_pm")[]): RacePreLunchDayContext {
  const ctx = buildRacePreLunchDayContext({
    weightKg,
    planDate: "2026-09-20", // domenica
    routineConfig: {
      week_plan: {
        Sun: { day_mode: "race", training1_start_time: "13:30", training1_duration_minutes: 180 },
      },
    },
    plannedSessions: [{ duration_minutes: 180, type: "race", notes: "Gara" }],
    activeMealSlots: activeSlots ?? ["breakfast", "lunch", "dinner"],
  });
  assert.ok(ctx, "contesto pre-gara atteso sul giorno gara");
  return ctx!;
}

/** Budget di slot GENEROSO: oggi farebbe scattare sia la proteina sia il dolce di top-up. */
const FAT_SLOT_BUDGET = { kcal: 1800, carbsG: 260, proteinG: 80, fatG: 50 };

test("REGOLA 1 · atleta 73 kg: il pre-gara ha esattamente 3 voci (staple + grana + olio)", () => {
  const ctx = raceCtxFor(73);
  const meal = composeRacePreLunchMainMeal(ctx.mealSlot, FAT_SLOT_BUDGET, 3, ctx);
  const names = meal.items.map((i) => i.name).join(" | ");

  assert.equal(meal.items.length, 3, `atteso protocollo a 3 voci, ottenuto: ${names}`);
  assert.match(names, /Pasta|Riso/);
  assert.match(names, /Grana/);
  assert.match(names, /Olio/);
});

test("REGOLA 1 · nessuna proteina aggiunta dal generativo e nessun dolce di riempimento", () => {
  const ctx = raceCtxFor(73);
  // Più seed: la scelta della proteina ruotava sul seed, quindi il divieto va provato su più giri.
  for (const seed of [0, 1, 2, 3, 7, 11, 42]) {
    const meal = composeRacePreLunchMainMeal(ctx.mealSlot, FAT_SLOT_BUDGET, seed, ctx);
    const names = meal.items.map((i) => i.name).join(" | ");
    assert.doesNotMatch(names, ADDED_PROTEIN, `seed ${seed}: proteina aggiunta dal generativo → ${names}`);
    assert.doesNotMatch(names, KCAL_TOPUP, `seed ${seed}: dolce di riempimento kcal → ${names}`);
    assert.equal(meal.items.length, 3, `seed ${seed}: ${names}`);
  }
});

test("REGOLA 1 · 73 kg → ~219 g CHO dallo staple, olio 15-20 g, grana 15-20 g", () => {
  const ctx = raceCtxFor(73);
  const meal = composeRacePreLunchMainMeal(ctx.mealSlot, FAT_SLOT_BUDGET, 3, ctx);

  const staple = meal.items.find((i) => /Pasta|Riso/.test(i.name));
  assert.ok(staple, "staple pasta/riso atteso");
  assert.match(staple!.portionHint, /219 g CHO/, staple!.portionHint);

  const oil = meal.items.find((i) => /Olio/.test(i.name));
  assert.ok(oil, "olio EVO atteso");
  const oilG = Number(/(\d+)\s*g olio/i.exec(oil!.portionHint)?.[1] ?? 0);
  assert.ok(oilG >= 15 && oilG <= 20, `olio ${oilG} g fuori 15-20`);

  const grana = meal.items.find((i) => /Grana/.test(i.name));
  assert.ok(grana, "grana padano atteso");
  const granaG = Number(/(\d+)\s*g grana/i.exec(grana!.portionHint)?.[1] ?? 0);
  assert.ok(granaG >= 15 && granaG <= 20, `grana ${granaG} g fuori 15-20`);
});

test("REGOLA 1 · allergico al latte: niente grana, restano staple e olio (2 voci)", () => {
  const ctx = raceCtxFor(73);
  const meal = composeRacePreLunchMainMeal(
    ctx.mealSlot,
    FAT_SLOT_BUDGET,
    3,
    ctx,
    undefined,
    new Set(["latte"]),
  );
  const names = meal.items.map((i) => i.name).join(" | ");
  assert.doesNotMatch(names, /Grana/, `grana servito a un allergico al latte: ${names}`);
  assert.doesNotMatch(names, ADDED_PROTEIN, names);
  assert.doesNotMatch(names, KCAL_TOPUP, names);
  assert.equal(meal.items.length, 2, names);
  assert.match(names, /Pasta|Riso/);
  assert.match(names, /Olio/);
});

test("REGOLA 1 · celiaco: lo staple diventa riso, sempre 3 voci", () => {
  const ctx = raceCtxFor(73);
  const meal = composeRacePreLunchMainMeal(
    ctx.mealSlot,
    FAT_SLOT_BUDGET,
    3,
    ctx,
    undefined,
    new Set(["glutine"]),
  );
  const names = meal.items.map((i) => i.name).join(" | ");
  assert.match(names, /Riso/, names);
  assert.doesNotMatch(names, /Pasta/, names);
  assert.doesNotMatch(names, KCAL_TOPUP, names);
  assert.equal(meal.items.length, 3, names);
});

// ── Residuo kcal: va agli altri pasti, non a ristuffare il pre-gara ───────────────────

function raceRequest(ctx: RacePreLunchDayContext): IntelligentMealPlanRequest {
  return {
    athleteId: "athlete-m1",
    planDate: "2026-09-20",
    dietType: "omnivore",
    contextLines: [],
    trainingDayLines: [],
    pathwayTimingLines: [],
    slots: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 2800, integrationLeverLines: [] },
    racePreLunch: ctx,
  } as IntelligentMealPlanRequest;
}

const requirements = { energy: { mealsKcal: 2800 } } as import("@empathy/contracts").DailyNutritionRequirementsV2;

test("REGOLA 1 · il residuo kcal del pre-gara va sugli altri pasti (totale giorno invariato)", () => {
  const ctx = raceCtxFor(60, ["breakfast", "lunch", "dinner", "snack_pm"]);
  assert.equal(ctx.mealSlot, "lunch");

  const slots: MealPlanV2DietSlotBudget[] = [
    { key: "breakfast", label: "Colazione", pct: 20, kcal: 560, carbs: 70, protein: 28, fat: 16 },
    { key: "lunch", label: "Pranzo", pct: 45, kcal: 1260, carbs: 170, protein: 63, fat: 35 },
    { key: "snack_pm", label: "Spuntino", pct: 10, kcal: 280, carbs: 35, protein: 14, fat: 8 },
    { key: "dinner", label: "Cena", pct: 25, kcal: 700, carbs: 88, protein: 35, fat: 19 },
  ];
  const dayBudget = slots.reduce((s, x) => s + x.kcal, 0);

  const out = composeMealPlanV2(requirements, slots, new Map() as FdcPoolMap, {
    request: raceRequest(ctx),
  });

  const pre = out.find((s) => s.slot === "lunch");
  assert.ok(pre);
  // Il pre-gara costa meno del suo budget e NON viene ristuffato…
  assert.ok(pre!.totals.kcal < 1260, `pre-gara ${pre!.totals.kcal} kcal, budget 1260`);
  // …e il suo target dichiarato scende a quanto il protocollo pesa davvero.
  assert.ok(
    Math.abs(pre!.targetKcal - pre!.totals.kcal) <= 5,
    `target ${pre!.targetKcal} vs servito ${pre!.totals.kcal}`,
  );

  // Il residuo è sugli altri pasti: il totale dei budget del giorno resta quello di prima.
  const dayAfter = out.reduce((s, x) => s + x.targetKcal, 0);
  assert.ok(Math.abs(dayAfter - dayBudget) <= 4, `giorno ${dayAfter} vs ${dayBudget}`);
  for (const key of ["breakfast", "snack_pm", "dinner"]) {
    const before = slots.find((s) => s.key === key)!.kcal;
    const after = out.find((s) => s.slot === key)!.targetKcal;
    assert.ok(after > before, `${key}: ${after} non ha ricevuto il residuo (era ${before})`);
  }
});

test("REGOLA 1 · pre-gara più caro del suo budget: gli altri pasti restano intatti", () => {
  const ctx = raceCtxFor(85, ["breakfast", "lunch", "dinner"]);
  const slots: MealPlanV2DietSlotBudget[] = [
    { key: "breakfast", label: "Colazione", pct: 25, kcal: 700, carbs: 90, protein: 35, fat: 20 },
    { key: "lunch", label: "Pranzo", pct: 40, kcal: 1120, carbs: 150, protein: 56, fat: 31 },
    { key: "dinner", label: "Cena", pct: 35, kcal: 980, carbs: 125, protein: 49, fat: 27 },
  ];
  const out = composeMealPlanV2(requirements, slots, new Map() as FdcPoolMap, {
    request: raceRequest(ctx),
  });
  const pre = out.find((s) => s.slot === "lunch")!;
  assert.ok(pre.totals.kcal > 1120, `atteso sforamento del budget, ${pre.totals.kcal}`);
  // Nessuna riduzione degli altri pasti: il protocollo non “ruba” kcal alla cena.
  assert.equal(out.find((s) => s.slot === "breakfast")!.targetKcal, 700);
  assert.equal(out.find((s) => s.slot === "dinner")!.targetKcal, 980);
});
