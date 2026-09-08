import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAthleteHrThresholds } from "./athlete-hr-thresholds";

type Result = { data: unknown; error: { message: string } | null };

/**
 * Stub minimale di supabase-js: replica il fatto che NON lancia mai — ritorna
 * `{ data, error }`. È il punto del difetto R-carico #6: le letture di profilo giravano
 * dentro un `try/catch`, quindi un errore non veniva mai visto e le soglie diventavano
 * vuote in silenzio.
 */
function stubDb(physiological: Result, athlete: Result): SupabaseClient {
  const chain = (result: Result) => {
    const api: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) {
      api[method] = () => api;
    }
    api.maybeSingle = async () => result;
    return api;
  };
  return {
    from(table: string) {
      return chain(table === "physiological_profiles" ? physiological : athlete);
    },
  } as unknown as SupabaseClient;
}

const OK_EMPTY: Result = { data: null, error: null };

test("readAthleteHrThresholds: legge lt2 → threshold → max dall'anagrafica", async () => {
  const read = await readAthleteHrThresholds(
    stubDb(
      { data: { lt2_heart_rate: 175 }, error: null },
      { data: { threshold_hr_bpm: 188, max_hr_bpm: 202 }, error: null },
    ),
    "athlete-1",
  );
  assert.equal(read.ok, true);
  assert.equal(read.thresholds.lthrBpm, 175);
  assert.equal(read.thresholds.athleteHrMaxBpm, 202);
});

test("readAthleteHrThresholds: atleta senza soglie ⇒ ok con soglie vuote", async () => {
  const read = await readAthleteHrThresholds(stubDb(OK_EMPTY, OK_EMPTY), "athlete-2");
  assert.equal(read.ok, true);
  assert.deepEqual(
    { lthr: read.thresholds.lthrBpm, max: read.thresholds.athleteHrMaxBpm },
    { lthr: null, max: null },
  );
});

/**
 * R-carico #6 — errore di lettura ≠ atleta senza soglie.
 * Prima: `Promise.all` dentro `try/catch`, supabase-js non lancia → l'errore spariva e
 * TUTTE le sedute del giro finivano sul ramo peggiore senza un log.
 */
test("readAthleteHrThresholds: se athlete_profiles non risponde l'errore è dichiarato, non ingoiato", async () => {
  const read = await readAthleteHrThresholds(
    stubDb(OK_EMPTY, { data: null, error: { message: "permission denied for table athlete_profiles" } }),
    "athlete-3",
  );
  assert.equal(read.ok, false);
  assert.ok(read.ok === false && read.error.includes("athlete_hr_thresholds_read_failed"));
  assert.ok(read.ok === false && read.error.includes("permission denied"));
  // Le soglie restano vuote, ma il chiamante SA che è un guasto e lo marca in `trace_summary`.
  assert.equal(read.thresholds.lthrBpm, null);
});

test("readAthleteHrThresholds: anche un errore sul solo profilo fisiologico è dichiarato", async () => {
  const read = await readAthleteHrThresholds(
    stubDb({ data: null, error: { message: "timeout" } }, { data: { threshold_hr_bpm: 188 }, error: null }),
    "athlete-4",
  );
  assert.equal(read.ok, false);
});
