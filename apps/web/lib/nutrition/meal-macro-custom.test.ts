/**
 * ITEM 1 — macro custom per-pasto (Profile Diet → `meal_macro_custom`).
 * Contratto: solo pasti con split VALIDO (tre campi, 0–100, somma ~100) deviano dal
 * globale; malformato/assente/preset-UI-intonso → comportamento identico a prima.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readMealMacroCustom, resolveNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import { buildDietMealSlotBudgets } from "@/lib/nutrition/diet-meal-slot-budgets";

const MEAL_TIMES = {
  breakfast: "07:30",
  lunch: "13:00",
  dinner: "20:00",
  snack_am: "10:30",
  snack_pm: "16:30",
  snack_evening: "22:30",
};

test("readMealMacroCustom: nessun custom → null", () => {
  assert.equal(readMealMacroCustom({}), null);
  assert.equal(readMealMacroCustom({ meal_macro_custom: null }), null);
  assert.equal(readMealMacroCustom({ meal_macro_custom: "spazzatura" }), null);
});

test("readMealMacroCustom: custom parziale (solo pranzo) → solo lunch nel risultato", () => {
  const map = readMealMacroCustom({
    meal_macro_custom: { lunch: { cho_pct: 60, pro_pct: 25, fat_pct: 15 } },
  });
  assert.ok(map);
  assert.deepEqual(Object.keys(map), ["lunch"]);
  assert.equal(Math.round(map.lunch!.carbs), 60);
});

test("readMealMacroCustom: pasto malformato (somma 150) → scartato", () => {
  const map = readMealMacroCustom({
    meal_macro_custom: {
      lunch: { cho_pct: 80, pro_pct: 40, fat_pct: 30 }, // somma 150 → ignora
      dinner: { cho_pct: 30, pro_pct: 40, fat_pct: 30 }, // valido
    },
  });
  assert.ok(map);
  assert.equal(map.lunch, undefined);
  assert.ok(map.dinner);
});

test("readMealMacroCustom: valori fuori range o campi mancanti → scartati", () => {
  assert.equal(
    readMealMacroCustom({ meal_macro_custom: { lunch: { cho_pct: 120, pro_pct: -30, fat_pct: 10 } } }),
    null,
  );
  assert.equal(readMealMacroCustom({ meal_macro_custom: { lunch: { cho_pct: 50 } } }), null);
});

test("readMealMacroCustom: somma 98 (arrotondamenti UI) → accettato e normalizzato a 100", () => {
  const map = readMealMacroCustom({
    meal_macro_custom: { breakfast: { cho_pct: 55, pro_pct: 20, fat_pct: 23 } },
  });
  assert.ok(map?.breakfast);
  const sum = map.breakfast.carbs + map.breakfast.protein + map.breakfast.fat;
  assert.ok(Math.abs(sum - 100) < 0.001);
});

test("readMealMacroCustom: preset UI intonso su tutti i pasti → null (retro-compat)", () => {
  // defaultDietDayConfig() scrive SEMPRE questi valori al salvataggio del profilo:
  // trattarli come custom cambierebbe i piani di tutti gli atleti già salvati.
  const map = readMealMacroCustom({
    meal_macro_custom: {
      breakfast: { cho_pct: 55, pro_pct: 20, fat_pct: 25 },
      lunch: { cho_pct: 45, pro_pct: 30, fat_pct: 25 },
      dinner: { cho_pct: 40, pro_pct: 35, fat_pct: 25 },
      snacks: { cho_pct: 60, pro_pct: 20, fat_pct: 20 },
    },
  });
  assert.equal(map, null);
});

test("readMealMacroCustom: preset UI con UN pasto modificato → custom attivo su tutti i pasti letti", () => {
  const map = readMealMacroCustom({
    meal_macro_custom: {
      breakfast: { cho_pct: 55, pro_pct: 20, fat_pct: 25 },
      lunch: { cho_pct: 70, pro_pct: 20, fat_pct: 10 }, // toccato dal coach
      dinner: { cho_pct: 40, pro_pct: 35, fat_pct: 25 },
      snacks: { cho_pct: 60, pro_pct: 20, fat_pct: 20 },
    },
  });
  assert.ok(map);
  assert.equal(Math.round(map.lunch!.carbs), 70);
  assert.equal(Math.round(map.breakfast!.carbs), 55);
});

test("buildDietMealSlotBudgets: senza macroSplitByMeal → identico a oggi (split globale ovunque)", () => {
  const base = {
    mealCountMode: "4",
    caloricDistribution: { breakfast: 30, lunch: 35, dinner: 25, snacks: 10 },
    dailyKcal: 2000,
    macroSplit: { carbs: 50, protein: 25, fat: 25 },
    mealTimes: MEAL_TIMES,
  };
  const before = buildDietMealSlotBudgets(base);
  const after = buildDietMealSlotBudgets({ ...base, macroSplitByMeal: null });
  assert.deepEqual(after, before);
});

test("buildDietMealSlotBudgets: custom solo pranzo → pranzo deviato, altri slot su split globale", () => {
  const rows = buildDietMealSlotBudgets({
    mealCountMode: "4",
    caloricDistribution: { breakfast: 30, lunch: 35, dinner: 25, snacks: 10 },
    dailyKcal: 2000,
    macroSplit: { carbs: 50, protein: 25, fat: 25 },
    macroSplitByMeal: { lunch: { carbs: 70, protein: 20, fat: 10 } },
    mealTimes: MEAL_TIMES,
  });
  const lunch = rows.find((r) => r.key === "lunch")!;
  const breakfast = rows.find((r) => r.key === "breakfast")!;
  // kcal slot invariati (derivano solo da caloric_distribution)
  assert.equal(lunch.kcal, 700);
  assert.equal(breakfast.kcal, 600);
  // pranzo: 70% CHO su 700 kcal → 122–123 g
  assert.equal(lunch.carbs, Math.round((700 * 0.7) / 4));
  assert.equal(lunch.fat, Math.round((700 * 0.1) / 9));
  // colazione resta sul globale 50/25/25
  assert.equal(breakfast.carbs, Math.round((600 * 0.5) / 4));
});

test("buildDietMealSlotBudgets: voce snacks copre i tre spuntini (6 pasti)", () => {
  const rows = buildDietMealSlotBudgets({
    mealCountMode: "6",
    caloricDistribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 10 },
    dailyKcal: 3000,
    macroSplit: { carbs: 50, protein: 25, fat: 25 },
    macroSplitByMeal: { snacks: { carbs: 80, protein: 10, fat: 10 } },
    mealTimes: MEAL_TIMES,
  });
  for (const key of ["snack_am", "snack_pm", "snack_evening"] as const) {
    const s = rows.find((r) => r.key === key)!;
    assert.equal(s.carbs, Math.round((s.kcal * 0.8) / 4), `slot ${key} deve usare lo split snacks custom`);
  }
  const dinner = rows.find((r) => r.key === "dinner")!;
  assert.equal(dinner.carbs, Math.round((dinner.kcal * 0.5) / 4));
});

test("resolveNutritionDietDay: mealMacroCustom esposto dal week_plan, null su legacy/missing", () => {
  // 2026-07-20 è un lunedì → chiave Mon
  const resolved = resolveNutritionDietDay(
    {
      week_plan: {
        Mon: {
          meal_count_mode: "4",
          caloric_distribution: { breakfast: 30, lunch: 35, dinner: 25, snacks: 10 },
          daily_macros: { cho_pct: 50, pro_pct: 25, fat_pct: 25 },
          meal_macro_custom: { dinner: { cho_pct: 20, pro_pct: 50, fat_pct: 30 } },
        },
      },
    },
    "2026-07-20",
  );
  assert.equal(resolved.source, "week_plan");
  assert.ok(resolved.mealMacroCustom?.dinner);
  assert.equal(Math.round(resolved.mealMacroCustom!.dinner!.protein), 50);

  const missing = resolveNutritionDietDay({}, "2026-07-20");
  assert.equal(missing.mealMacroCustom, null);
});
