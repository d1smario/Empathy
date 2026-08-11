/**
 * Traccia eventi: le due proprietà che in review erano risultate solo dichiarate.
 * 1) un fallimento della scrittura NON sparisce in silenzio (postgrest non lancia: senza
 *    leggere `{ error }` il try/catch era codice morto, e in QA «zero righe» diventava
 *    indistinguibile da «il cron non è mai partito»);
 * 2) la colonna `athlete_id` resta NULL, perché la RLS di `empathy_events` apre in lettura
 *    all'atleta e al suo coach proprio le righe che ce l'hanno valorizzata — e qui dentro
 *    ci sono messaggi d'errore grezzi di motore e DB.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordEmpathyEvent } from "@/lib/observability/empathy-event-trace";

type Insert = Record<string, unknown>;

/** Client finto: registra la tabella e la riga, e restituisce l'esito che gli si chiede. */
function fakeDb(outcome: { error?: { message: string } } | "throws") {
  const seen: Array<{ table: string; row: Insert }> = [];
  const db = {
    from(table: string) {
      return {
        async insert(row: Insert) {
          seen.push({ table, row });
          if (outcome === "throws") throw new Error("socket hang up");
          return outcome;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { db, seen };
}

/** console.warn silenziato e catturato: il log È il comportamento sotto test. */
async function withCapturedWarn<T>(fn: () => Promise<T>): Promise<{ result: T; warnings: unknown[][] }> {
  const original = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = original;
  }
}

test("traccia: scrittura riuscita ⇒ true, e l'evento finisce su empathy_events", async () => {
  const { db, seen } = fakeDb({});
  const { result, warnings } = await withCapturedWarn(() =>
    recordEmpathyEvent(db, { eventType: "nutrition.weekly_replan.run", payload: { daysWritten: 84 } }),
  );
  assert.equal(result, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].table, "empathy_events");
  assert.equal(seen[0].row.event_type, "nutrition.weekly_replan.run");
  assert.deepEqual(seen[0].row.payload, { daysWritten: 84 });
  assert.deepEqual(warnings, []); // il caso normale non sporca i log
});

test("traccia: athlete_id resta NULL — la RLS non deve mostrare gli errori interni all'atleta", async () => {
  const { db, seen } = fakeDb({});
  await withCapturedWarn(() =>
    recordEmpathyEvent(db, {
      eventType: "nutrition.weekly_replan.athlete",
      // L'atleta sta nel payload, dove la policy di SELECT non arriva.
      payload: { athleteId: "b0082091-0000-0000-0000-000000000000", dayErrors: [{ day: "2026-08-17", error: 'violates FK "meal_item_fdc_id_fkey"' }] },
    }),
  );
  assert.equal(seen[0].row.athlete_id, null);
  assert.equal((seen[0].row.payload as Record<string, unknown>).athleteId, "b0082091-0000-0000-0000-000000000000");
});

test("traccia: errore restituito da postgrest ⇒ false e un warn, mai scarto silenzioso", async () => {
  const { db } = fakeDb({ error: { message: 'relation "empathy_events" does not exist' } });
  const { result, warnings } = await withCapturedWarn(() =>
    recordEmpathyEvent(db, { eventType: "nutrition.weekly_replan.run", payload: {} }),
  );
  assert.equal(result, false);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /traccia non scritta/);
  assert.match(JSON.stringify(warnings[0][1]), /does not exist/);
});

test("traccia: eccezione del client ⇒ false e un warn, ma il cron NON fallisce per colpa della traccia", async () => {
  const { db } = fakeDb("throws");
  const { result, warnings } = await withCapturedWarn(() =>
    recordEmpathyEvent(db, { eventType: "nutrition.weekly_replan.athlete", payload: {} }),
  );
  assert.equal(result, false); // nessun throw propagato: il chiamante prosegue
  assert.equal(warnings.length, 1);
  assert.match(JSON.stringify(warnings[0][1]), /socket hang up/);
});
