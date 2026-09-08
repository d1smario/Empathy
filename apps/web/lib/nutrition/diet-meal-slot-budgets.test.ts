import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDietMealSlotBudgets,
  dietMealSlotSpecsForMode,
  normalizeCaloricDistribution,
  resolveSixMealSnackPercentages,
} from "./diet-meal-slot-budgets";

describe("diet-meal-slot-budgets", () => {
  it("normalizza distribuzione a 100%", () => {
    const n = normalizeCaloricDistribution({ breakfast: 30, lunch: 30, dinner: 20, snacks: 10 });
    assert.equal(Math.round(n.breakfast + n.lunch + n.dinner + n.snacks), 100);
  });

  it("6 pasti: tre spuntini con quota snacks/3 ciascuno", () => {
    const specs = dietMealSlotSpecsForMode("6");
    assert.deepEqual(specs.map((s) => s.key), [
      "breakfast",
      "snack_am",
      "lunch",
      "snack_pm",
      "dinner",
      "snack_evening",
    ]);
    const rows = buildDietMealSlotBudgets({
      mealCountMode: "6",
      caloricDistribution: { breakfast: 30, lunch: 30, dinner: 20, snacks: 10 },
      dailyKcal: 4000,
      macroSplit: { carbs: 50, protein: 25, fat: 25 },
      mealTimes: {
        breakfast: "07:30",
        lunch: "13:00",
        dinner: "20:00",
        snack_am: "10:30",
        snack_pm: "16:30",
        snack_evening: "22:30",
      },
    });
    const breakfast = rows.find((r) => r.key === "breakfast")!;
    const evening = rows.find((r) => r.key === "snack_evening")!;
    assert.equal(breakfast.kcal, 1200);
    assert.equal(evening.kcal, Math.round((4000 * (10 / 3)) / 100));
    assert.ok(
      rows.reduce((s, r) => s + r.kcal, 0) >= 3990,
      `somma kcal ${rows.reduce((s, r) => s + r.kcal, 0)} attesa >= 3990`,
    );
  });

  it("6 pasti: 25/25/20 + campo Spuntini=10 inteso come 10% per ciascuno dei 3 spuntini", () => {
    const r = resolveSixMealSnackPercentages({ breakfast: 25, lunch: 25, dinner: 20, snacks: 10 });
    assert.ok(
      Math.abs(r.snack_am - 10) < 0.5,
      `snack_am ${r.snack_am} atteso vicino a 10 (0 decimali)`,
    );
    assert.equal(r.snacksTotal, 30);
    const rows = buildDietMealSlotBudgets({
      mealCountMode: "6",
      caloricDistribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 10 },
      dailyKcal: 3000,
      macroSplit: { carbs: 50, protein: 25, fat: 25 },
      mealTimes: {
        breakfast: "07:30",
        lunch: "13:00",
        dinner: "20:00",
        snack_am: "10:30",
        snack_pm: "16:30",
        snack_evening: "22:30",
      },
    });
    assert.equal(rows.length, 6);
    assert.equal(rows.find((x) => x.key === "snack_evening")!.kcal, 300);
  });
});
