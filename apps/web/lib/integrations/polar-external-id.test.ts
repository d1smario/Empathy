import assert from "node:assert/strict";
import test from "node:test";

import { polarDailyExternalId, polarExerciseExternalId } from "@/lib/integrations/polar-external-id";

const ATLETA_A = "20529424-61d7-47c8-84df-9e9b221aaa49";
const ATLETA_B = "e9e8dc46-3ae6-412b-85e3-118b16aacb5b";

test("sonno Polar: due atleti nella stessa notte NON possono condividere external_event_id", () => {
  const rec = { date: "2026-08-04", sleep_start_time: "2026-08-03T23:10:00" };
  const a = polarDailyExternalId({ kind: "sleep", athleteId: ATLETA_A, rec });
  const b = polarDailyExternalId({ kind: "sleep", athleteId: ATLETA_B, rec });

  assert.ok(a && b);
  assert.notEqual(
    a,
    b,
    "l'indice uq_device_sync_exports_provider_event non ha athlete_id: id uguali = riga contesa fra atleti",
  );
  assert.ok(a.includes(ATLETA_A));
  assert.ok(b.includes(ATLETA_B));
});

test("nightly recharge Polar: stessa regola del sonno", () => {
  const rec = { date: "2026-08-04", nightly_recharge_status: "GOOD" };
  const a = polarDailyExternalId({ kind: "recharge", athleteId: ATLETA_A, rec });
  const b = polarDailyExternalId({ kind: "recharge", athleteId: ATLETA_B, rec });
  assert.notEqual(a, b);
});

test("sonno e recharge dello stesso atleta/giorno restano distinti", () => {
  const rec = { date: "2026-08-04" };
  assert.notEqual(
    polarDailyExternalId({ kind: "sleep", athleteId: ATLETA_A, rec }),
    polarDailyExternalId({ kind: "recharge", athleteId: ATLETA_A, rec }),
  );
});

test("id stabile fra due pull consecutivi dello stesso giorno", () => {
  const primo = polarDailyExternalId({ kind: "sleep", athleteId: ATLETA_A, rec: { date: "2026-08-04" } });
  const secondo = polarDailyExternalId({
    kind: "sleep",
    athleteId: ATLETA_A,
    rec: { date: "2026-08-04", heart_rate_avg: 48 },
  });
  assert.equal(primo, secondo, "senza stabilità l'upsert non troverebbe mai la riga da aggiornare");
});

test("record senza data: nessun id (meglio saltare che inventare una chiave)", () => {
  assert.equal(polarDailyExternalId({ kind: "sleep", athleteId: ATLETA_A, rec: {} }), null);
  assert.equal(polarDailyExternalId({ kind: "sleep", athleteId: ATLETA_A, rec: { date: "  " } }), null);
});

test("esercizio Polar: id del provider, già univoco", () => {
  assert.equal(polarExerciseExternalId({ id: "aQlC83" }), "aQlC83");
  assert.equal(polarExerciseExternalId({ id: 12 }), null);
  assert.equal(polarExerciseExternalId({}), null);
});
