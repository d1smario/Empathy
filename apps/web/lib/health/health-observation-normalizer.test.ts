/**
 * Lineage delle osservazioni Health: il grafo causale non deve nascere vuoto, e quando
 * nasce vuoto lo si deve poter sapere.
 *
 * DIFETTO RIPRODOTTO QUI (verificato in produzione, non ipotizzato):
 * `observation_lineage.metadata` è `jsonb NOT NULL DEFAULT '{}'`. postgrest-js, su
 * `.insert(array)`, calcola l'UNIONE delle chiavi di TUTTE le righe e la manda come
 * `?columns=...`; con `defaultToNull` (il default) una chiave assente da un oggetto NON
 * lascia agire il DEFAULT della colonna, arriva come NULL esplicito. Il normalizer
 * produceva un array misto — la riga `created_extraction_run` con `metadata`, quelle di
 * `appendObservationLineage` senza — quindi ogni upload che generava almeno
 * un'osservazione mandava a picco l'INTERO batch con 23502.
 *
 * Prova reale su prod (PostgREST, service role, l'insert fallisce quindi non scrive nulla):
 *   code 23502 · null value in column "metadata" of relation "observation_lineage"
 *   violates not-null constraint
 * E la firma nei dati: ogni extraction_run con obs=0 ha lineage=1, ogni run con obs>0 ha
 * lineage=0. Nessuna eccezione, su 10 run.
 *
 * I test qui sotto lavorano su un finto PostgREST che riproduce quelle due regole: se il
 * normalizer torna a mandare un array a chiavi disomogenee, tornano rossi.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistNormalizedObservations } from "@/lib/health/health-observation-normalizer";

// La traccia su `empathy_events` deve passare dal client del chiamante quando il service
// role non è configurato: qui lo si toglie di mezzo, così il fake db la vede.
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

type Row = Record<string, unknown>;
type PgError = { code: string; message: string };

/** Colonne `NOT NULL DEFAULT ...`: il DEFAULT protegge la chiave ASSENTE, non il NULL esplicito. */
const NOT_NULL_WITH_DEFAULT: Record<string, string[]> = {
  observation_lineage: ["metadata"],
};

function queryResult(payload: { data: unknown; error: PgError | null }) {
  const self = {
    select: () => self,
    /** Come PostgREST: `maybeSingle()` restituisce l'oggetto, non l'array di una riga. */
    maybeSingle: () =>
      queryResult({
        data: Array.isArray(payload.data) ? (payload.data[0] ?? null) : payload.data,
        error: payload.error,
      }),
    then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
      Promise.resolve(payload).then(onOk, onErr),
  };
  return self;
}

/**
 * Finto PostgREST. Riproduce le due regole che generano il difetto:
 *  1. `.insert(array)` manda l'unione delle chiavi come lista colonne;
 *  2. chiave assente ⇒ NULL esplicito (mai il DEFAULT della colonna).
 * Poi applica i NOT NULL come farebbe Postgres.
 */
function fakeDb(opts: { forcedErrors?: Record<string, PgError> } = {}) {
  /** Payload GREZZO ricevuto da `.insert()`: è lì che si vede la disomogeneità. */
  const sent: Record<string, Row[]> = {};
  /** Lista colonne che postgrest-js metterebbe in `?columns=`. */
  const columnsSent: Record<string, string[]> = {};
  /** Righe effettivamente accettate. */
  const stored: Record<string, Row[]> = {};
  let seq = 0;

  const db = {
    from(table: string) {
      return {
        insert(values: Row | Row[]) {
          const rows = Array.isArray(values) ? values : [values];
          (sent[table] ??= []).push(...rows);

          const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
          columnsSent[table] = columns;
          const materialized = rows.map((r) =>
            Object.fromEntries(columns.map((c) => [c, c in r ? r[c] : null])),
          );

          for (const col of NOT_NULL_WITH_DEFAULT[table] ?? []) {
            if (materialized.some((r) => r[col] === null)) {
              return queryResult({
                data: null,
                error: {
                  code: "23502",
                  message: `null value in column "${col}" of relation "${table}" violates not-null constraint`,
                },
              });
            }
          }

          const forced = opts.forcedErrors?.[table];
          if (forced) return queryResult({ data: null, error: forced });

          const withIds = materialized.map((r) => ({ ...r, id: `${table}-${++seq}` }));
          (stored[table] ??= []).push(...withIds);
          return queryResult({ data: withIds.map((r) => ({ id: r.id })), error: null });
        },
      };
    },
  } as unknown as SupabaseClient;

  return { db, sent, columnsSent, stored };
}

/** console.warn silenziato: `recordEmpathyEvent` logga, e non deve sporcare l'output dei test. */
async function silencingWarn<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = original;
  }
}

/** Referto sangue con due marker veri d'ontologia ⇒ 2 osservazioni ⇒ 3 righe di lineage. */
const BLOOD_INPUT = {
  athleteId: "20529424-61d7-47c8-84df-9e9b221aaa49",
  panelId: "11111111-1111-1111-1111-111111111111",
  panelType: "blood" as const,
  parsed: { hba1c: 5.2, emoglobina: "14,8" },
  sampleDate: "2026-09-01",
  sourceKind: "pdf" as const,
  parserVersion: "health-parser-v2",
};

test("il fake riproduce la regola postgrest: chiave assente ⇒ NULL esplicito, non DEFAULT", async () => {
  const { db, columnsSent } = fakeDb();
  const { error } = (await db.from("observation_lineage").insert([
    { athlete_id: "a", relation: "r1", metadata: { k: 1 } },
    { athlete_id: "a", relation: "r2" },
  ])) as unknown as { error: PgError | null };
  assert.ok(columnsSent.observation_lineage.includes("metadata"));
  assert.equal(error?.code, "23502");
  assert.match(error?.message ?? "", /metadata.*not-null/);
});

test("insert batch: ogni riga di lineage porta il proprio metadata (chiavi omogenee)", async () => {
  const { db, sent } = fakeDb();
  await silencingWarn(() => persistNormalizedObservations({ db, ...BLOOD_INPUT }));

  const rows = sent.observation_lineage ?? [];
  assert.ok(rows.length >= 2, "servono almeno due righe per esercitare l'unione delle chiavi");

  // La proprietà che PostgREST pretende: un solo insieme di chiavi per tutto l'array.
  const shapes = new Set(rows.map((r) => Object.keys(r).sort().join(",")));
  assert.equal(shapes.size, 1, `chiavi disomogenee fra le righe: ${[...shapes].join(" | ")}`);
  for (const row of rows) {
    assert.ok("metadata" in row, "riga di lineage senza chiave metadata");
    assert.notEqual(row.metadata, null, "metadata a NULL esplicito: viola il NOT NULL");
  }
});

test("referto con osservazioni: il lineage viene scritto davvero (non più 23502)", async () => {
  const { db, stored } = fakeDb();
  const res = await silencingWarn(() => persistNormalizedObservations({ db, ...BLOOD_INPUT }));

  assert.equal(res.inserted, 2);
  assert.equal(res.lineageInserted, 3); // 1 created_extraction_run + 2 extracted_observation
  assert.equal(res.lineageError, null);
  assert.equal((stored.observation_lineage ?? []).length, 3);
  assert.deepEqual(
    (stored.observation_lineage ?? []).map((r) => r.relation).sort(),
    ["created_extraction_run", "extracted_observation", "extracted_observation"],
  );
  assert.equal((stored.empathy_events ?? []).length, 0, "niente da tracciare quando va bene");
});

test("pannello ormoni: lineage omogeneo anche con due tabelle di osservazioni", async () => {
  const { db, sent, stored } = fakeDb();
  const res = await silencingWarn(() =>
    persistNormalizedObservations({
      db,
      ...BLOOD_INPUT,
      panelType: "hormones",
      parsed: { cortisol_am: 14.1, testosterone: 620 },
    }),
  );

  // 2 lab + 2 hormone observations, e una riga di lineage per ciascuna + quella del run.
  assert.equal(res.inserted, 4);
  assert.equal(res.lineageInserted, 5);
  const shapes = new Set((sent.observation_lineage ?? []).map((r) => Object.keys(r).sort().join(",")));
  assert.equal(shapes.size, 1);
  assert.deepEqual(
    [...new Set((stored.observation_lineage ?? []).map((r) => r.target_table))].sort(),
    ["extraction_runs", "hormone_observations", "lab_observations"],
  );
});

test("lineage che fallisce comunque: non fa fallire la normalizzazione ma lascia traccia", async () => {
  const { db, stored } = fakeDb({
    forcedErrors: { observation_lineage: { code: "42501", message: "new row violates row-level security policy" } },
  });

  const res = await silencingWarn(() => persistNormalizedObservations({ db, ...BLOOD_INPUT }));

  // Le osservazioni sono lavoro, e restano.
  assert.equal(res.inserted, 2);
  assert.equal((stored.lab_observations ?? []).length, 2);
  // Il lineage è mancato, e lo dice.
  assert.equal(res.lineageInserted, 0);
  assert.match(res.lineageError ?? "", /row-level security/);

  // E soprattutto: non sparisce in silenzio.
  const events = stored.empathy_events ?? [];
  assert.equal(events.length, 1);
  assert.equal(events[0].event_type, "health.observation_lineage.insert_failed");
  assert.equal(events[0].athlete_id, null, "traccia ops-only: la RLS di lettura non deve agganciarla");
  const payload = events[0].payload as Record<string, unknown>;
  assert.equal(payload.athlete_id, BLOOD_INPUT.athleteId);
  assert.equal(payload.panel_id, BLOOD_INPUT.panelId);
  assert.equal(payload.rows_attempted, 3);
  assert.equal(payload.observations_inserted, 2);
  assert.equal(payload.error_code, "42501");
  assert.match(String(payload.error), /row-level security/);
});

test("un fallimento delle osservazioni resta bloccante (il lavoro non è best-effort)", async () => {
  const { db } = fakeDb({
    forcedErrors: { lab_observations: { code: "23503", message: "insert or update violates foreign key constraint" } },
  });
  await assert.rejects(
    () => persistNormalizedObservations({ db, ...BLOOD_INPUT }),
    /foreign key constraint/,
  );
});
