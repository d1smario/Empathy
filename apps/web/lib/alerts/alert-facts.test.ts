import assert from "node:assert/strict";
import test from "node:test";
import { alertPayloadFacts } from "@/lib/alerts/alert-facts";

/**
 * Contratto STRUTTURATO del payload: è quello che consuma il pannello coach per comporre
 * il dettaglio con `t()` (IT/EN). Le stringhe italiane dell'admin sono verificate a parte
 * in `admin-alerts-format.test.ts`: qui si controlla che i NUMERI arrivino giusti.
 */

test("sleep_low: ore dormite e target come numeri, anche se il jsonb li dà come stringhe", () => {
  assert.deepEqual(alertPayloadFacts("sleep_low", { sleep_hours: 5.24, target_hours: 8 }), {
    detail: "sleep",
    sleptHours: 5.24,
    targetHours: 8,
  });
  assert.deepEqual(alertPayloadFacts("sleep_low", { sleep_hours: "5.5", target_hours: "8" }), {
    detail: "sleep",
    sleptHours: 5.5,
    targetHours: 8,
  });
});

test("training: `basis` normalizzato — 'duration' resta, tutto il resto ricade su 'tss'", () => {
  assert.deepEqual(alertPayloadFacts("training_under", { basis: "duration", planned: 60, executed: 20 }), {
    detail: "training",
    executed: 20,
    planned: 60,
    basis: "duration",
  });
  assert.deepEqual(alertPayloadFacts("training_over", { basis: "tss", planned: 80, executed: 130.4 }), {
    detail: "training",
    executed: 130.4,
    planned: 80,
    basis: "tss",
  });
  // `basis` assente o sconosciuto: mai un'unità inventata, si ricade su TSS.
  assert.deepEqual(alertPayloadFacts("training_over", { planned: 80, executed: 130 }), {
    detail: "training",
    executed: 130,
    planned: 80,
    basis: "tss",
  });
});

test("plan_adjusted: solo le kind stringa non vuote, altrimenti nessun dettaglio", () => {
  assert.deepEqual(alertPayloadFacts("plan_adjusted", { kinds: ["reduction", "", 3, "reintegration"] }), {
    detail: "adjustments",
    kinds: ["reduction", "reintegration"],
  });
  assert.equal(alertPayloadFacts("plan_adjusted", { kinds: [] }), null);
  assert.equal(alertPayloadFacts("plan_adjusted", { kinds: "reduction" }), null);
});

test("payload assente/incompleto/non numerico → null: la riga resta valida, solo più scarna", () => {
  assert.equal(alertPayloadFacts("sleep_low", null), null);
  assert.equal(alertPayloadFacts("sleep_low", { sleep_hours: 5 }), null);
  assert.equal(alertPayloadFacts("training_over", { basis: "tss", planned: "x", executed: 100 }), null);
  assert.equal(alertPayloadFacts("sleep_missing", { any: 1 }), null);
});
