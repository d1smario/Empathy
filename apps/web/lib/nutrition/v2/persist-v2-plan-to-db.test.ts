/**
 * Regressione persist V2 → nutrition_plan.inputs_provenance.
 * La colonna prod è `jsonb NOT NULL DEFAULT '{}'`: con day-engine ASSENTE (mode=off,
 * il kill switch, o ramo day-engine caduto in catch) il persist deve scrivere `{}`,
 * MAI null — null → 23502 not-null violation → OGNI generazione della Edge Function
 * risponderebbe 500 e la route Next servirebbe piani mai persistiti (Oggi vuoto).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealPlanV2ComposedSlot } from "@empathy/contracts";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import type { DayEngineProvenance } from "@/lib/nutrition/v2/day-engine-integration";
import { persistV2PlanToDb } from "@/lib/nutrition/v2/persist-v2-plan-to-db";

type Captured = { planInsert?: Record<string, unknown> };

/** Client finto: cattura l'insert su nutrition_plan, risponde ok su tutto il resto. */
function makeFakeAdmin(captured: Captured): SupabaseClient {
  const fake = {
    from(table: string) {
      if (table === "nutrition_plan") {
        return {
          delete() {
            const chain = {
              eq: () => chain,
              then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
            };
            return chain;
          },
          insert(payload: Record<string, unknown>) {
            captured.planInsert = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: "plan-1" }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "meal") {
        return {
          insert: (rows: Array<{ slot: string }>) => ({
            select: async () => ({
              data: rows.map((r, i) => ({ id: `meal-${i + 1}`, slot: r.slot })),
              error: null,
            }),
          }),
        };
      }
      // meal_item
      return { insert: async () => ({ error: null }) };
    },
  };
  return fake as unknown as SupabaseClient;
}

function makeProduction(dayEngine?: DayEngineProvenance): MealPlanV2Production {
  const slot: MealPlanV2ComposedSlot = {
    slot: "breakfast",
    labelIt: "Colazione",
    targetKcal: 500,
    items: [
      {
        fdcId: 123,
        description: "Fiocchi d'avena",
        grams: 80,
        kcal: 300,
        choG: 50,
        proG: 10,
        fatG: 6,
      },
    ],
    totals: { kcal: 300, choG: 50, proG: 10, fatG: 6 },
  };
  return {
    engine: "nutrition_v2",
    algorithmVersion: "nutrition_meal_plan_v2_production",
    taxonomyVersion: "test",
    // Il persist non legge requirements: fixture minimale.
    requirements: {} as MealPlanV2Production["requirements"],
    dietMealSlotBudgets: [],
    composedMealPlan: [slot],
    ...(dayEngine ? { dayEngine } : {}),
  };
}

test("persist: day-engine ASSENTE (mode off / catch) → inputs_provenance {} e mai null", async () => {
  const captured: Captured = {};
  const res = await persistV2PlanToDb(makeFakeAdmin(captured), "ath-1", "2026-08-10", makeProduction());
  assert.deepEqual(res, { ok: true, planId: "plan-1" });
  assert.ok(captured.planInsert, "insert nutrition_plan atteso");
  assert.notEqual(captured.planInsert!.inputs_provenance, null, "MAI null: colonna jsonb NOT NULL");
  assert.deepEqual(captured.planInsert!.inputs_provenance, {}, "identico al default '{}' della colonna");
});

test("persist: day-engine presente → inputs_provenance.day_engine = report QA", async () => {
  const dayEngine: DayEngineProvenance = {
    engine: "day_classification_v1",
    mode: "shadow",
    applied: false,
    applicable: false,
    reason: "lean_mass_missing",
    strategiaPct: 100,
    fuelingChoG: 0,
    flags: [],
    slots: [],
  };
  const captured: Captured = {};
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured),
    "ath-1",
    "2026-08-10",
    makeProduction(dayEngine),
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1" });
  assert.deepEqual(captured.planInsert!.inputs_provenance, { day_engine: dayEngine });
});
