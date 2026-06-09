import assert from "node:assert/strict";
import test from "node:test";
import { computePostWorkoutMealFlags } from "./nutrition-meal-times-training-coherence";
import type { FlatMealTimes } from "./routine-week-plan-meal-times";

test("computePostWorkoutMealFlags: sessione 9:30→12:00 → snack_am post-workout, pranzo 13:00 no flag", () => {
  const mealTimesFlatFromRoot: FlatMealTimes = {
    breakfast: "07:00",
    lunch: "13:00",
    dinner: "19:00",
    snack_am: "10:30",
    snack_pm: "16:00",
  };
  const flags = computePostWorkoutMealFlags({
    routineConfig: {
      week_plan: {
        Sun: {
          has_training: true,
          training1_start_time: "09:30",
          training1_duration_minutes: 150,
        },
      },
      meal_times: mealTimesFlatFromRoot,
    },
    planDate: "2026-06-07",
    mealTimesFlatFromRoot,
    plannedSessions: [{ duration_minutes: 150 }],
    activeMealSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"],
    mealTimesBySlot: mealTimesFlatFromRoot,
  });
  assert.equal(flags.snack_am, true);
  assert.notEqual(flags.lunch, true);
});

test("computePostWorkoutMealFlags: long Saturday session shifts lunch → lunch flagged post-workout", () => {
  const mealTimesFlatFromRoot: FlatMealTimes = {
    breakfast: "07:30",
    lunch: "13:00",
    dinner: "20:00",
    snack_am: "10:00",
    snack_pm: "16:30",
  };
  const routineConfig = {
    week_plan: {
      Sat: {
        breakfast_time: "07:30",
        lunch_time: "13:00",
        dinner_time: "20:00",
        snack_time: "10:00",
        afternoon_snack_time: "16:30",
        has_training: true,
        training1_start_time: "10:00",
        training1_duration_minutes: 240,
      },
    },
    meal_times: {
      breakfast: "07:30",
      lunch: "13:00",
      dinner: "20:00",
      snack_am: "10:00",
      snack_pm: "16:30",
    },
  };

  const flags = computePostWorkoutMealFlags({
    routineConfig,
    planDate: "2026-05-09",
    mealTimesFlatFromRoot,
    plannedSessions: [{ duration_minutes: 240 }],
  });

  assert.equal(flags.lunch, true, "lunch should move after training end + buffer vs base 13:00");
});
