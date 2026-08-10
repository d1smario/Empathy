import test from "node:test";
import assert from "node:assert/strict";
import { AUTO_DECODE_SESSION_WINDOW, resolveAutoDecodeLabel } from "./auto-decode-sessions";

test("finestra satura: l'etichetta dichiara finestra E totale (non più '24' fisso)", () => {
  const label = resolveAutoDecodeLabel({ analyzed: AUTO_DECODE_SESSION_WINDOW, total: 373 });
  assert.deepEqual(label, {
    key: "autoDecodeActiveWindow",
    sessionsAnalyzed: 24,
    sessionsTotal: 373,
  });
});

test("storico più corto della finestra: etichetta semplice, il numero è tutto lo storico", () => {
  assert.deepEqual(resolveAutoDecodeLabel({ analyzed: 12, total: 12 }), {
    key: "autoDecodeActive",
    sessionsAnalyzed: 12,
  });
});

test("totale non disponibile (conteggio fallito): etichetta semplice, nessun totale inventato", () => {
  assert.deepEqual(resolveAutoDecodeLabel({ analyzed: 24, total: null }), {
    key: "autoDecodeActive",
    sessionsAnalyzed: 24,
  });
});

test("zero sedute analizzate: nessuna etichetta", () => {
  assert.equal(resolveAutoDecodeLabel({ analyzed: 0, total: 0 }), null);
  assert.equal(resolveAutoDecodeLabel({ analyzed: 0, total: 120 }), null);
});

test("totale incoerente (minore delle analizzate) non produce 'su N' assurdi", () => {
  assert.deepEqual(resolveAutoDecodeLabel({ analyzed: 24, total: 3 }), {
    key: "autoDecodeActive",
    sessionsAnalyzed: 24,
  });
});
