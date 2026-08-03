import assert from "node:assert/strict";
import test from "node:test";
import { formatAlertAthleteName, formatAlertPayloadDetail } from "@/lib/alerts/admin-alerts-format";

test("formatAlertAthleteName: nome+cognome vince sull'email", () => {
  assert.equal(
    formatAlertAthleteName({ first_name: "Mario", last_name: "Rossi", email: "m@d1s.ch" }),
    "Mario Rossi",
  );
});

test("formatAlertAthleteName: solo uno dei due nomi → niente spazi penzolanti", () => {
  assert.equal(formatAlertAthleteName({ first_name: "Mario", last_name: null, email: null }), "Mario");
  assert.equal(formatAlertAthleteName({ first_name: "   ", last_name: "Rossi", email: null }), "Rossi");
});

test("formatAlertAthleteName: senza nome ripiega sull'email, senza nulla ritorna null", () => {
  assert.equal(formatAlertAthleteName({ first_name: null, last_name: null, email: "m@d1s.ch" }), "m@d1s.ch");
  assert.equal(formatAlertAthleteName({ first_name: "", last_name: "", email: "  " }), null);
  assert.equal(formatAlertAthleteName(undefined), null);
});

test("formatAlertPayloadDetail: sleep_low mostra dormite vs target", () => {
  assert.equal(
    formatAlertPayloadDetail("sleep_low", { sleep_hours: 5.24, target_hours: 8, threshold_hours: 6.4, ratio: 0.66 }),
    "5.2 h dormite su 8.0 h di target",
  );
});

test("formatAlertPayloadDetail: training usa l'unità giusta secondo `basis`", () => {
  assert.equal(
    formatAlertPayloadDetail("training_over", { basis: "tss", planned: 80, executed: 130.4, ratio: 1.63 }),
    "130 TSS eseguiti su 80 pianificati",
  );
  assert.equal(
    formatAlertPayloadDetail("training_under", { basis: "duration", planned: 60, executed: 20, ratio: 0.33 }),
    "20 min eseguiti su 60 pianificati",
  );
});

test("formatAlertPayloadDetail: plan_adjusted elenca le kind attive", () => {
  assert.equal(
    formatAlertPayloadDetail("plan_adjusted", { kinds: ["reduction", "reintegration"], reasons: [] }),
    "reduction + reintegration",
  );
});

test("formatAlertPayloadDetail: payload assente/incompleto/non numerico → null, mai stringa rotta", () => {
  assert.equal(formatAlertPayloadDetail("sleep_low", null), null);
  assert.equal(formatAlertPayloadDetail("sleep_low", { sleep_hours: 5 }), null);
  assert.equal(formatAlertPayloadDetail("training_over", { basis: "tss", planned: "x", executed: 100 }), null);
  assert.equal(formatAlertPayloadDetail("plan_adjusted", { kinds: [] }), null);
  assert.equal(formatAlertPayloadDetail("plan_adjusted", { kinds: "reduction" }), null);
});

test("formatAlertPayloadDetail: sleep_missing non ha dettaglio (il dato è assente per definizione)", () => {
  assert.equal(formatAlertPayloadDetail("sleep_missing", { any: 1 }), null);
});

test("formatAlertPayloadDetail: numeri arrivati come stringhe dal jsonb restano leggibili", () => {
  assert.equal(
    formatAlertPayloadDetail("sleep_low", { sleep_hours: "5.5", target_hours: "8" }),
    "5.5 h dormite su 8.0 h di target",
  );
});
