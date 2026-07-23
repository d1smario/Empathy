import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  composeMealPlanV2,
  mealPlanSeedForAthleteDate,
  type FdcPoolMap,
} from "@/lib/nutrition/v2/compose-meal-plan-v2";
import {
  mealRotationStaplesFromComposedItems,
  rotationKeyForCanonical,
} from "@/lib/nutrition/v2/fdc-staple-registry";
import { ROTATION_MAX_WEEK_USES } from "@/lib/nutrition/meal-composition-rules";

const requirements = { energy: { mealsKcal: 3200 } } as import("@empathy/contracts").DailyNutritionRequirementsV2;

const WEEK_DATES = [
  "2026-06-01",
  "2026-06-02",
  "2026-06-03",
  "2026-06-04",
  "2026-06-05",
  "2026-06-06",
  "2026-06-07",
];

function lunchDinnerSlots(): MealPlanV2DietSlotBudget[] {
  return [
    {
      key: "lunch",
      label: "Pranzo",
      pct: 35,
      kcal: 1100,
      carbs: 130,
      protein: 55,
      fat: 28,
    },
    {
      key: "dinner",
      label: "Cena",
      pct: 30,
      kcal: 950,
      carbs: 110,
      protein: 48,
      fat: 24,
    },
  ];
}

function baseRequest(planDate: string): IntelligentMealPlanRequest {
  return {
    athleteId: "rotation-test",
    planDate,
    dietType: "omnivore",
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
    mealPlanSolverMeta: { dailyMealsKcalTotal: 3200, integrationLeverLines: [] },
    slots: [],
  };
}

test("mealRotationStaplesFromComposedItems: chiavi rotation compatibili con cache settimanale", () => {
  const keys = mealRotationStaplesFromComposedItems([
    { canonicalKey: "pasta_dry" },
    { canonicalKey: "chicken_breast" },
  ]);
  assert.ok(keys.includes("carb:pasta"));
  assert.ok(keys.includes("prot:pollo"));
  assert.equal(rotationKeyForCanonical("rice_dry"), "carb:riso");
});

test("mealPlanSeedForAthleteDate: deterministico e sensibile ad atleta e data", () => {
  const a = mealPlanSeedForAthleteDate("athlete-1", "2026-07-22");
  assert.equal(a, mealPlanSeedForAthleteDate("athlete-1", "2026-07-22"));
  assert.ok(Number.isInteger(a) && a >= 0);
  assert.notEqual(a, mealPlanSeedForAthleteDate("athlete-1", "2026-07-23"));
  assert.notEqual(a, mealPlanSeedForAthleteDate("athlete-2", "2026-07-22"));
  // 7 giorni consecutivi → seed tutti distinti (niente seed degenerato da somma-data).
  const seeds = WEEK_DATES.map((d) => mealPlanSeedForAthleteDate("athlete-1", d));
  assert.equal(new Set(seeds).size, WEEK_DATES.length);
});

test("composeMealPlanV2: stesso (atleta, data) → stesso piano; date diverse → primo giorno diverso", () => {
  const emptyPools = new Map() as FdcPoolMap;
  const run = (planDate: string, athleteId = "rotation-test") =>
    composeMealPlanV2(requirements, lunchDinnerSlots(), emptyPools, {
      request: { ...baseRequest(planDate), athleteId },
    });

  // Idempotenza: persist replace per (atleta, data) invariato.
  assert.deepEqual(run("2026-06-01"), run("2026-06-01"));

  // A memoria settimanale VUOTA, la rotazione da sola varia i cibi tra i giorni.
  const firstPicks = WEEK_DATES.map((d) =>
    run(d)
      .flatMap((s) => s.items)
      .map((i) => i.canonicalKey)
      .join("|"),
  );
  assert.ok(new Set(firstPicks).size >= 4, `Rotazione piatta: ${firstPicks.join("\n")}`);
});

test("V2 alternanza settimanale: 7 giorni lunch+dinner -> >=4 carb e >=4 prot, max 3 usi per staple", () => {
  const weeklyStapleCounts: Record<string, number> = {};
  const stapleByDay: string[][] = [];
  const emptyPools = new Map() as FdcPoolMap;

  for (const planDate of WEEK_DATES) {
    const out = composeMealPlanV2(requirements, lunchDinnerSlots(), emptyPools, {
      request: { ...baseRequest(planDate), weeklyStapleCounts: { ...weeklyStapleCounts } },
    });
    const dayStaples = mealRotationStaplesFromComposedItems(out.flatMap((s) => s.items));
    stapleByDay.push(dayStaples);
    for (const s of dayStaples) {
      weeklyStapleCounts[s] = (weeklyStapleCounts[s] ?? 0) + 1;
    }
    /** Ogni giorno deve avere carb diversi a pranzo e cena quando possibile (pool espanso lug 2026). */
    const CARB_RE = /pasta|riso|patat|farro|quinoa|cous|orzo|bulgur|miglio|polenta/i;
    const lunchCarb = out.find((s) => s.slot === "lunch")?.items.find((i) => CARB_RE.test(i.description));
    const dinnerCarb = out.find((s) => s.slot === "dinner")?.items.find((i) => CARB_RE.test(i.description));
    assert.ok(lunchCarb, `${planDate}: pranzo senza carb staple`);
    assert.ok(dinnerCarb, `${planDate}: cena senza carb staple`);
    if (lunchCarb?.canonicalKey && dinnerCarb?.canonicalKey) {
      assert.notEqual(
        rotationKeyForCanonical(lunchCarb.canonicalKey),
        rotationKeyForCanonical(dinnerCarb.canonicalKey),
        `${planDate}: stesso carb pranzo+cena`,
      );
    }
  }

  const violations = Object.entries(weeklyStapleCounts).filter(([, n]) => n > ROTATION_MAX_WEEK_USES);
  assert.equal(
    violations.length,
    0,
    `Rotazione violata: ${violations.map(([k, n]) => `${k}=${n}`).join(", ")}\n${stapleByDay.map((d, i) => `${WEEK_DATES[i]}: ${d.join(", ")}`).join("\n")}`,
  );

  const carbStaples = Object.keys(weeklyStapleCounts).filter((k) => k.startsWith("carb:"));
  assert.ok(carbStaples.length >= 4, `Solo ${carbStaples.length} carb distinti: ${carbStaples.join(", ")}`);

  const protStaples = Object.keys(weeklyStapleCounts).filter((k) => k.startsWith("prot:"));
  assert.ok(protStaples.length >= 3, `Solo ${protStaples.length} prot distinti: ${protStaples.join(", ")}`);
});
