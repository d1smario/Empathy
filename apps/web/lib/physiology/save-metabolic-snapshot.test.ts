import test from "node:test";
import assert from "node:assert/strict";
import { saveMetabolicSnapshot, type MetabolicSnapshotDb } from "./save-metabolic-snapshot";

type Call = { table: string; op: "insert" | "upsert" | "delete"; payload?: unknown; id?: string };

function fakeDb(opts: {
  insertError?: string;
  insertId?: string | null;
  upsertError?: string;
  deleteError?: string;
}): { db: MetabolicSnapshotDb; calls: Call[] } {
  const calls: Call[] = [];
  const db: MetabolicSnapshotDb = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          calls.push({ table, op: "insert", payload: row });
          return {
            select() {
              return {
                async maybeSingle() {
                  if (opts.insertError) return { data: null, error: { message: opts.insertError } };
                  return {
                    data: opts.insertId === null ? {} : { id: opts.insertId ?? "run-1" },
                    error: null,
                  };
                },
              };
            },
          };
        },
        async upsert(row: Record<string, unknown>) {
          calls.push({ table, op: "upsert", payload: row });
          return { error: opts.upsertError ? { message: opts.upsertError } : null };
        },
        delete() {
          return {
            async eq(_column: string, value: string) {
              calls.push({ table, op: "delete", id: value });
              return { error: opts.deleteError ? { message: opts.deleteError } : null };
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

const INPUT = {
  athleteId: "athlete-1",
  runSection: "metabolic_profile" as const,
  modelVersion: "v0.2",
  inputPayload: { p5: "300" },
  outputPayload: { ftp: 265 },
  createdBy: null,
  profileUpdate: {
    ftp_watts: 265,
    lt1_watts: 190,
    lt2_watts: 250,
    v_lamax: 0.42,
    vo2max_ml_min_kg: 58.3,
    cp_watts: 272,
  },
  nowIso: "2026-08-11T09:00:00.000Z",
};

test("percorso felice: run + profilo scritti, nessun delete", async () => {
  const { db, calls } = fakeDb({});
  const res = await saveMetabolicSnapshot(db, INPUT);
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(
    calls.map((c) => `${c.op}:${c.table}`),
    ["insert:metabolic_lab_runs", "upsert:physiological_profiles"],
  );
});

test("upsert profilo fallito: il run appena scritto viene rimosso (niente pagina≠fueling)", async () => {
  const { db, calls } = fakeDb({ upsertError: "permission denied", insertId: "run-42" });
  const res = await saveMetabolicSnapshot(db, INPUT);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.rolledBack, true);
  assert.match(res.error, /permission denied/);
  const del = calls.find((c) => c.op === "delete");
  assert.deepEqual(del, { table: "metabolic_lab_runs", op: "delete", id: "run-42" });
});

test("rollback impossibile (id non restituito): errore esplicito, nessun delete alla cieca", async () => {
  const { db, calls } = fakeDb({ upsertError: "boom", insertId: null });
  const res = await saveMetabolicSnapshot(db, INPUT);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.rolledBack, false);
  assert.match(res.error, /non annullabile/);
  assert.equal(
    calls.some((c) => c.op === "delete"),
    false,
  );
});

test("rollback fallito: si dichiara nell'errore invece di far credere che sia tutto a posto", async () => {
  const { db } = fakeDb({ upsertError: "boom", deleteError: "delete blocked" });
  const res = await saveMetabolicSnapshot(db, INPUT);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.rolledBack, false);
  assert.match(res.error, /delete blocked/);
});

test("insert del run fallito: nessun upsert del profilo (niente colonna avanti al run)", async () => {
  const { db, calls } = fakeDb({ insertError: "insert ko" });
  const res = await saveMetabolicSnapshot(db, INPUT);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.rolledBack, false);
  assert.equal(
    calls.some((c) => c.op === "upsert"),
    false,
  );
});

test("sezioni non-metaboliche: solo il run, il profilo non si tocca", async () => {
  const { db, calls } = fakeDb({});
  const res = await saveMetabolicSnapshot(db, {
    ...INPUT,
    runSection: "lactate_analysis",
    profileUpdate: null,
  });
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(
    calls.map((c) => c.op),
    ["insert"],
  );
});
