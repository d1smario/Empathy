import test from "node:test";
import assert from "node:assert/strict";
import {
  mapDbRows,
  setLogKey,
  validateSetLogRow,
  visibleSetCount,
} from "@/lib/training/exercise-set-log";

test("accetta una serie normale", () => {
  assert.equal(validateSetLogRow({ setIndex: 3, reps: 8, weightKg: 82.5 }), null);
});

test("reps e carico possono mancare: «fatta» senza numeri è una risposta", () => {
  assert.equal(validateSetLogRow({ setIndex: 1 }), null);
  assert.equal(validateSetLogRow({ setIndex: 1, reps: null, weightKg: null }), null);
});

test("il corpo libero è zero chili, non un errore", () => {
  assert.equal(validateSetLogRow({ setIndex: 1, weightKg: 0 }), null);
});

test("rifiuta i numeri impossibili invece di scriverli", () => {
  assert.equal(validateSetLogRow({ setIndex: 0 }), "set_index");
  assert.equal(validateSetLogRow({ setIndex: 51 }), "set_index");
  assert.equal(validateSetLogRow({ setIndex: 1.5 }), "set_index");
  assert.equal(validateSetLogRow({ setIndex: 1, reps: -1 }), "reps");
  assert.equal(validateSetLogRow({ setIndex: 1, reps: 1001 }), "reps");
  assert.equal(validateSetLogRow({ setIndex: 1, weightKg: -5 }), "weight_kg");
  assert.equal(validateSetLogRow({ setIndex: 1, weightKg: 1001 }), "weight_kg");
  assert.equal(validateSetLogRow({ setIndex: 1, weightKg: Number.NaN }), "weight_kg");
});

test("le serie mostrate sono quelle prescritte", () => {
  assert.equal(visibleSetCount(5, 0), 5);
});

test("una serie in più registrata non sparisce dalla schermata", () => {
  assert.equal(visibleSetCount(4, 6), 6);
});

test("senza prescrizione resta almeno una serie", () => {
  assert.equal(visibleSetCount(null, 0), 1);
  assert.equal(visibleSetCount(0, 0), 1);
  assert.equal(visibleSetCount(undefined, 0), 1);
});

test("mai oltre il limite della tabella", () => {
  assert.equal(visibleSetCount(999, 0), 50);
});

test("la chiave distingue blocchi diversi con lo stesso numero di serie", () => {
  assert.notEqual(setLogKey("a", 1), setLogKey("b", 1));
  assert.equal(setLogKey("a", 1), setLogKey("a", 1));
});

test("mapDbRows legge i numeri anche quando arrivano come stringhe", () => {
  const out = mapDbRows([{ block_id: "b1", set_index: "2", reps: "8", weight_kg: "82.50", done: true }]);
  assert.deepEqual(out, [
    { blockId: "b1", setIndex: 2, reps: 8, weightKg: 82.5, done: true, recordedByRole: "athlete" },
  ]);
});

test("mapDbRows scarta le righe senza aggancio invece di inventarlo", () => {
  assert.deepEqual(mapDbRows([{ set_index: 1 }]), []);
  assert.deepEqual(mapDbRows([{ block_id: "b1" }]), []);
  assert.deepEqual(mapDbRows([{ block_id: "", set_index: 1 }]), []);
});

test("done assente vale «fatta»; solo false è «saltata»", () => {
  assert.equal(mapDbRows([{ block_id: "b", set_index: 1 }])[0]?.done, true);
  assert.equal(mapDbRows([{ block_id: "b", set_index: 1, done: false }])[0]?.done, false);
});

test("chi ha registrato viene letto dalla riga", () => {
  assert.equal(mapDbRows([{ block_id: "b", set_index: 1, recorded_by_role: "coach" }])[0]?.recordedByRole, "coach");
  assert.equal(mapDbRows([{ block_id: "b", set_index: 1, recorded_by_role: "admin" }])[0]?.recordedByRole, "admin");
  assert.equal(mapDbRows([{ block_id: "b", set_index: 1, recorded_by_role: "athlete" }])[0]?.recordedByRole, "athlete");
});

test("un valore ignoto non diventa qualcos'altro di silenzioso", () => {
  assert.equal(mapDbRows([{ block_id: "b", set_index: 1 }])[0]?.recordedByRole, "athlete");
  assert.equal(mapDbRows([{ block_id: "b", set_index: 1, recorded_by_role: "pinco" }])[0]?.recordedByRole, "athlete");
});
