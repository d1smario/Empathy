import assert from "node:assert/strict";
import test from "node:test";
import {
  isNutritionMealPlanEngineV2Active,
  resolveNutritionMealPlanEngine,
} from "@/lib/nutrition/v2/resolve-nutrition-meal-plan-engine";

test("default engine v2 (unica fonte persistita)", () => {
  const prev = process.env.NUTRITION_MEAL_PLAN_ENGINE;
  delete process.env.NUTRITION_MEAL_PLAN_ENGINE;
  assert.equal(resolveNutritionMealPlanEngine(null), "v2");
  if (prev) process.env.NUTRITION_MEAL_PLAN_ENGINE = prev;
});

test("rollback per-atleta a v1 via config", () => {
  assert.equal(resolveNutritionMealPlanEngine({ meal_plan_engine: "v1" }), "v1");
});

test("env engine v2", () => {
  const prev = process.env.NUTRITION_MEAL_PLAN_ENGINE;
  process.env.NUTRITION_MEAL_PLAN_ENGINE = "v2";
  assert.equal(resolveNutritionMealPlanEngine(null), "v2");
  assert.equal(isNutritionMealPlanEngineV2Active("v2"), true);
  if (prev) process.env.NUTRITION_MEAL_PLAN_ENGINE = prev;
  else delete process.env.NUTRITION_MEAL_PLAN_ENGINE;
});

test("per-athlete override shadow", () => {
  assert.equal(resolveNutritionMealPlanEngine({ meal_plan_engine: "shadow" }), "shadow");
});
