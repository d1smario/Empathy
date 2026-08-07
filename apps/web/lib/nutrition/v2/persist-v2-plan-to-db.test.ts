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

type Captured = { planInsert?: Record<string, unknown>; planInserts: Record<string, unknown>[] };

/** Client finto: cattura l'insert su nutrition_plan, risponde ok su tutto il resto.
 *  `failInsertsWithResponsePayloadColumn`: simula un ambiente PRE-migration (42703,
 *  colonna response_payload assente) → l'insert col payload fallisce, quello senza passa. */
function makeFakeAdmin(
  captured: Captured,
  opts?: { failInsertsWithResponsePayloadColumn?: boolean },
): SupabaseClient {
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
            captured.planInserts.push(payload);
            const columnMissing =
              opts?.failInsertsWithResponsePayloadColumn === true && "response_payload" in payload;
            return {
              select: () => ({
                single: async () =>
                  columnMissing
                    ? {
                        data: null,
                        error: { message: 'column "response_payload" of relation "nutrition_plan" does not exist' },
                      }
                    : { data: { id: "plan-1" }, error: null },
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
  const captured: Captured = { planInserts: [] };
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
  const captured: Captured = { planInserts: [] };
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured),
    "ath-1",
    "2026-08-10",
    makeProduction(dayEngine),
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1" });
  assert.deepEqual(captured.planInsert!.inputs_provenance, { day_engine: dayEngine });
});

/* ── Read-first (8 ago): response_payload persistito insieme al piano ─────────── */

test("persist: responsePayload passato → scritto in response_payload nella STESSA insert (mai update a due tempi)", async () => {
  const captured: Captured = { planInserts: [] };
  const payload = { layer: "deterministic_meal_assembly_v1", slots: [], solverBasis: { source: "nutrition_meal_plan_solver" } };
  const res = await persistV2PlanToDb(makeFakeAdmin(captured), "ath-1", "2026-08-10", makeProduction(), {
    responsePayload: payload,
  });
  assert.deepEqual(res, { ok: true, planId: "plan-1" });
  assert.equal(captured.planInserts.length, 1, "una sola scrittura del piano");
  assert.deepEqual(captured.planInsert!.response_payload, payload);
  // Regressione: il canale inputs_provenance resta intatto ({} senza day-engine).
  assert.deepEqual(captured.planInsert!.inputs_provenance, {});
});

test("persist: responsePayload assente (chiamante legacy) → response_payload NULL, insert ok", async () => {
  const captured: Captured = { planInserts: [] };
  const res = await persistV2PlanToDb(makeFakeAdmin(captured), "ath-1", "2026-08-10", makeProduction());
  assert.deepEqual(res, { ok: true, planId: "plan-1" });
  assert.equal(captured.planInsert!.response_payload, null);
});

test("persist: ambiente pre-migration (colonna assente, 42703) → retry senza payload, piano persistito comunque", async () => {
  const captured: Captured = { planInserts: [] };
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { failInsertsWithResponsePayloadColumn: true }),
    "ath-1",
    "2026-08-10",
    makeProduction(),
    { responsePayload: { layer: "deterministic_meal_assembly_v1" } },
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1" });
  assert.equal(captured.planInserts.length, 2, "primo insert col payload fallisce, il retry senza payload passa");
  assert.ok(!("response_payload" in captured.planInserts[1]!), "il retry non deve contenere la colonna mancante");
});
