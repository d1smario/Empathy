/**
 * READ-FIRST pagina Nutrizione (decisione 8 ago): test del servizio di lettura del
 * payload persistito (trovato / non trovato / malformato / errore → null, mai throw)
 * e del gate PURO dell'auto-generazione (mai generazione con payload presente, mai
 * race lettura/generazione, una sola generazione su miss).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntelligentMealPlanResponseBody } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  isRenderableMealPlanPayload,
  loadPersistedMealPlanPayload,
  mealPlanProbeKey,
  shouldAutoGenerateMealPlan,
} from "@/modules/nutrition/services/persisted-meal-plan";

/** Payload minimo che supera la guardia di renderizzabilità (stessa shape di parseMealPlanResponse). */
function validPayload(): IntelligentMealPlanResponseBody {
  return {
    layer: "deterministic_meal_assembly_v1",
    disclaimer: "test",
    slots: [],
    dayInteractionSummary: "test",
    solverBasis: { source: "nutrition_meal_plan_solver", planDate: "2026-08-10" },
  } as unknown as IntelligentMealPlanResponseBody;
}

type MaybeSingleResult = { data: { response_payload: unknown } | null; error: { message: string } | null };

/** Client finto: catena select→eq→eq→order→limit→maybeSingle su nutrition_plan. */
function makeFakeSupabase(result: MaybeSingleResult, opts?: { throwOnSelect?: boolean }): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => result,
  };
  const fake = {
    from(table: string) {
      assert.equal(table, "nutrition_plan");
      if (opts?.throwOnSelect) throw new Error("boom");
      return chain;
    },
  };
  return fake as unknown as SupabaseClient;
}

test("load: payload valido persistito → lo restituisce", async () => {
  const payload = validPayload();
  const db = makeFakeSupabase({ data: { response_payload: payload }, error: null });
  const got = await loadPersistedMealPlanPayload(db, "ath-1", "2026-08-10");
  assert.deepEqual(got, payload);
});

test("load: riga assente → null (la pagina degrada a generazione)", async () => {
  const db = makeFakeSupabase({ data: null, error: null });
  assert.equal(await loadPersistedMealPlanPayload(db, "ath-1", "2026-08-10"), null);
});

test("load: piano pre-migration con response_payload NULL → null (self-healing: si genera una volta)", async () => {
  const db = makeFakeSupabase({ data: { response_payload: null }, error: null });
  assert.equal(await loadPersistedMealPlanPayload(db, "ath-1", "2026-08-10"), null);
});

test("load: payload malformato (non renderizzabile) → null, mai in pagina", async () => {
  const db = makeFakeSupabase({ data: { response_payload: { layer: "qualcosa", slots: "no" } }, error: null });
  assert.equal(await loadPersistedMealPlanPayload(db, "ath-1", "2026-08-10"), null);
});

test("load: errore Supabase (es. colonna non ancora migrata) → null, mai throw", async () => {
  const db = makeFakeSupabase({ data: null, error: { message: "column nutrition_plan.response_payload does not exist" } });
  assert.equal(await loadPersistedMealPlanPayload(db, "ath-1", "2026-08-10"), null);
});

test("load: eccezione di rete → null, mai throw", async () => {
  const db = makeFakeSupabase({ data: null, error: null }, { throwOnSelect: true });
  assert.equal(await loadPersistedMealPlanPayload(db, "ath-1", "2026-08-10"), null);
});

test("load: argomenti vuoti → null senza query", async () => {
  const db = makeFakeSupabase({ data: null, error: null }, { throwOnSelect: true });
  assert.equal(await loadPersistedMealPlanPayload(db, "", "2026-08-10"), null);
  assert.equal(await loadPersistedMealPlanPayload(db, "ath-1", ""), null);
});

test("guardia: accetta entrambi i layer noti, rifiuta il resto", () => {
  assert.equal(isRenderableMealPlanPayload(validPayload()), true);
  assert.equal(isRenderableMealPlanPayload({ ...validPayload(), layer: "db_engine_v1" }), true);
  assert.equal(isRenderableMealPlanPayload(null), false);
  assert.equal(isRenderableMealPlanPayload([]), false);
  assert.equal(isRenderableMealPlanPayload({ ...validPayload(), slots: undefined }), false);
  assert.equal(
    isRenderableMealPlanPayload({ ...validPayload(), solverBasis: { source: "altro" } }),
    false,
  );
});

/* ── Gate puro auto-generazione ─────────────────────────────────────────────── */

const KEY = mealPlanProbeKey("ath-1", "2026-08-10");
const baseGate = {
  requestReady: true,
  probe: { key: KEY, found: false },
  expectedProbeKey: KEY,
  hasPlanInMemory: false,
  generationLoading: false,
  generationErrored: false,
};

test("gate: miss confermato per il giorno corrente → genera UNA volta", () => {
  assert.equal(shouldAutoGenerateMealPlan(baseGate), true);
});

test("gate: payload trovato → MAI generazione", () => {
  assert.equal(shouldAutoGenerateMealPlan({ ...baseGate, probe: { key: KEY, found: true } }), false);
});

test("gate: lettura non ancora risposta (probe null) → attesa, niente race", () => {
  assert.equal(shouldAutoGenerateMealPlan({ ...baseGate, probe: null }), false);
});

test("gate: probe stantìo di un altro giorno/atleta → attesa, niente race", () => {
  assert.equal(
    shouldAutoGenerateMealPlan({ ...baseGate, probe: { key: mealPlanProbeKey("ath-1", "2026-08-11"), found: false } }),
    false,
  );
});

test("gate: piano già in memoria → niente generazione", () => {
  assert.equal(shouldAutoGenerateMealPlan({ ...baseGate, hasPlanInMemory: true }), false);
});

test("gate: generazione in corso o fallita → niente retry-loop", () => {
  assert.equal(shouldAutoGenerateMealPlan({ ...baseGate, generationLoading: true }), false);
  assert.equal(shouldAutoGenerateMealPlan({ ...baseGate, generationErrored: true }), false);
});

test("gate: request non pronta → attesa", () => {
  assert.equal(shouldAutoGenerateMealPlan({ ...baseGate, requestReady: false }), false);
});
