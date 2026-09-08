import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveNutritionDietDay } from "./resolve-nutrition-diet-day";

function assertCloseTo(actual: number | undefined, expected: number, digits: number) {
  const tolerance = Math.pow(10, -digits) / 2;
  assert.ok(
    typeof actual === "number" && Number.isFinite(actual) && Math.abs(actual - expected) < tolerance,
    `atteso ${actual} vicino a ${expected} (${digits} decimali)`,
  );
}

describe("resolveNutritionDietDay", () => {
  it("legge week_plan per il weekday della data", () => {
    const nc = {
      week_plan: {
        Tue: {
          meal_count_mode: "6",
          day_type_pct: 100,
          caloric_distribution: { breakfast: 30, lunch: 30, dinner: 20, snacks: 10 },
          daily_macros: { cho_pct: 50, pro_pct: 25, fat_pct: 25 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.weekDayKey, "Tue");
    assert.equal(r.source, "week_plan");
    assert.equal(r.configured, true);
    assert.equal(r.mealCountMode, "6");
    assertCloseTo(r.caloricDistribution?.breakfast, 30, 0);
  });

  it("usa caloric_split legacy se week_plan ha solo meal_count_mode", () => {
    const nc = {
      caloric_split: {
        breakfast_pct: 30,
        lunch_pct: 30,
        dinner_pct: 20,
        snacks_pct: 10,
      },
      week_plan: {
        Tue: {
          meal_count_mode: "6",
          day_type_pct: 100,
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.configured, true);
    assert.equal(r.mealCountMode, "6");
    assertCloseTo(r.caloricDistribution?.lunch, 30, 0);
  });

  it("legge meal_plan.caloric_split se week_plan del giorno è vuoto", () => {
    const nc = {
      meal_strategy: "6-meals",
      meal_plan: {
        caloric_split: {
          breakfast_pct: 30,
          lunch_pct: 30,
          dinner_pct: 20,
          snacks_pct: 10,
        },
      },
      week_plan: {},
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.source, "legacy_root");
    assert.equal(r.configured, true);
    assert.equal(r.mealCountMode, "6");
    assertCloseTo(r.caloricDistribution?.snacks, 10, 0);
  });

  it("inferisce 6 pasti da 25/25/20 + snacks=10 (tre spuntini da 10%) anche senza meal_count_mode in JSON", () => {
    const nc = {
      week_plan: {
        Tue: {
          day_type_pct: 100,
          caloric_distribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 10 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.mealCountMode, "6");
    assert.equal(r.caloricDistribution?.snacks, 30);
    assertCloseTo(r.caloricDistribution?.snack_am, 10, 0);
  });

  it("completa % mancanti in parity Profile se c’è meal_count_mode ma nessuno split", () => {
    const nc = {
      week_plan: {
        Tue: { meal_count_mode: "4", day_type_pct: 100 },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.configured, true);
    assertCloseTo(r.caloricDistribution?.breakfast, 30, 0);
  });

  it("corregge meal_count_mode 4 → 6 se la ripartizione è 25/25/20 + tre spuntini da 10%", () => {
    const nc = {
      week_plan: {
        Tue: {
          meal_count_mode: "4",
          day_type_pct: 100,
          caloric_distribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 10 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.mealCountMode, "6");
    assertCloseTo(r.caloricDistribution?.snack_am, 10, 0);
  });

  it("riconosce 6 pasti con snacks totale 30% (tre spuntini salvati in Profile)", () => {
    const nc = {
      week_plan: {
        Tue: {
          meal_count_mode: "6",
          day_type_pct: 100,
          caloric_distribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 30 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.mealCountMode, "6");
    assertCloseTo(r.caloricDistribution?.snack_am, 10, 0);
  });

  it("legacy 4-meals + split 25/25/20/10 inferisce 6 pasti", () => {
    const nc = {
      meal_strategy: "4-meals",
      caloric_split: {
        breakfast_pct: 25,
        lunch_pct: 25,
        dinner_pct: 20,
        snacks_pct: 10,
      },
      week_plan: {},
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    assert.equal(r.mealCountMode, "6");
  });
});
