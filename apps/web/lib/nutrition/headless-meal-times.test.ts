/**
 * ITEM 2 — orari pasti nel path headless/cron (generate-meal-plan-v2-headless).
 * Il wiring usa `mealTimesFromRoutineWeekPlanForDate(routineConfig, planDate, DEFAULT)`:
 * qui verifichiamo il contratto del reader con gli stessi default del file headless e
 * che gli orari risolti finiscano davvero nei budget slot (→ mealRows.timeLocal →
 * scheduledTimeLocal della request cron).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mealTimesFromRoutineWeekPlanForDate, type FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";
import { buildDietMealSlotBudgets } from "@/lib/nutrition/diet-meal-slot-budgets";

/** Stessi valori di DEFAULT_MEAL_TIMES in generate-meal-plan-v2-headless.ts. */
const DEFAULT_MEAL_TIMES: FlatMealTimes & { snack_evening?: string } = {
  breakfast: "07:30",
  lunch: "13:00",
  dinner: "20:00",
  snack_am: "10:30",
  snack_pm: "16:30",
  snack_evening: "22:00",
};

// 2026-07-20 è un lunedì → chiave Mon
const PLAN_DATE = "2026-07-20";

test("routine con orari per il giorno → il reader li usa (mapping snack incluso)", () => {
  const routineConfig = {
    week_plan: {
      Mon: {
        breakfast_time: "06:15",
        snack_time: "09:45",
        lunch_time: "12:15",
        afternoon_snack_time: "15:30",
        dinner_time: "19:00",
        night_time: "21:45",
      },
    },
  };
  const t = mealTimesFromRoutineWeekPlanForDate(routineConfig, PLAN_DATE, DEFAULT_MEAL_TIMES);
  assert.equal(t.breakfast, "06:15");
  assert.equal(t.lunch, "12:15");
  assert.equal(t.dinner, "19:00");
  assert.equal(t.snack_am, "09:45"); // snack_time → snack_am
  assert.equal(t.snack_pm, "15:30"); // afternoon_snack_time → snack_pm
  assert.equal(t.snack_evening, "21:45"); // night_time → snack_evening
});

test("routine assente o giorno senza orari → restano i default hardcoded (comportamento attuale)", () => {
  assert.deepEqual(mealTimesFromRoutineWeekPlanForDate(null, PLAN_DATE, DEFAULT_MEAL_TIMES), DEFAULT_MEAL_TIMES);
  assert.deepEqual(
    mealTimesFromRoutineWeekPlanForDate({ week_plan: { Mon: {} } }, PLAN_DATE, DEFAULT_MEAL_TIMES),
    DEFAULT_MEAL_TIMES,
  );
});

test("orari parziali → i campi mancanti ricadono sul default, quelli presenti vincono", () => {
  const t = mealTimesFromRoutineWeekPlanForDate(
    { week_plan: { Mon: { lunch_time: "12:45" } } },
    PLAN_DATE,
    DEFAULT_MEAL_TIMES,
  );
  assert.equal(t.lunch, "12:45");
  assert.equal(t.breakfast, DEFAULT_MEAL_TIMES.breakfast);
  assert.equal(t.dinner, DEFAULT_MEAL_TIMES.dinner);
});

test("gli orari risolti finiscono nei budget slot (time → mealRows.timeLocal del path headless)", () => {
  const mealTimes = mealTimesFromRoutineWeekPlanForDate(
    { week_plan: { Mon: { breakfast_time: "06:00", dinner_time: "19:30" } } },
    PLAN_DATE,
    DEFAULT_MEAL_TIMES,
  );
  const budgets = buildDietMealSlotBudgets({
    mealCountMode: "5",
    caloricDistribution: { breakfast: 25, lunch: 35, dinner: 30, snacks: 10 },
    dailyKcal: 2400,
    macroSplit: { carbs: 50, protein: 25, fat: 25 },
    mealTimes,
  });
  assert.equal(budgets.find((b) => b.key === "breakfast")!.time, "06:00");
  assert.equal(budgets.find((b) => b.key === "dinner")!.time, "19:30");
  assert.equal(budgets.find((b) => b.key === "snack_am")!.time, DEFAULT_MEAL_TIMES.snack_am);
});
