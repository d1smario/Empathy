import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPhysiologyProfileUpsertRow,
  PHYSIOLOGY_PROFILE_COLUMNS_NOT_OWNED_HERE,
} from "./physiology-profile-upsert";

const UPDATE = {
  ftp_watts: 265,
  lt1_watts: 190,
  lt2_watts: 250,
  v_lamax: 0.42,
  vo2max_ml_min_kg: 58.3,
  cp_watts: 272,
};

test("la riga di upsert contiene ESATTAMENTE le colonne che il motore CP possiede", () => {
  const row = buildPhysiologyProfileUpsertRow("athlete-1", UPDATE, "2026-08-10T09:00:00.000Z");
  assert.deepEqual(Object.keys(row).sort(), [
    "athlete_id",
    "cp_watts",
    "ftp_watts",
    "lt1_watts",
    "lt2_watts",
    "updated_at",
    "v_lamax",
    "vo2max_ml_min_kg",
  ]);
});

test("nessuna colonna di baseline nel payload: l'upsert non deve azzerarle", () => {
  const row = buildPhysiologyProfileUpsertRow("athlete-1", UPDATE, "2026-08-10T09:00:00.000Z") as Record<
    string,
    unknown
  >;
  for (const col of PHYSIOLOGY_PROFILE_COLUMNS_NOT_OWNED_HERE) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(row, col),
      false,
      `${col} non deve comparire: PostgREST aggiorna solo le colonne presenti, quindi scriverla la sovrascriverebbe`,
    );
  }
});

test("updated_at è quello passato (freschezza vera) e cp_watts assente diventa null", () => {
  const row = buildPhysiologyProfileUpsertRow(
    "athlete-1",
    { ...UPDATE, cp_watts: undefined },
    "2026-08-10T09:00:00.000Z",
  );
  assert.equal(row.updated_at, "2026-08-10T09:00:00.000Z");
  assert.equal(row.cp_watts, null);
  assert.equal(row.ftp_watts, 265);
  assert.equal(row.vo2max_ml_min_kg, 58.3);
});
