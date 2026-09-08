import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeviceExportUpdatePatch,
  DeviceExportOwnerConflictError,
  shouldDedupeOnExternalEventId,
  writeDeviceSyncExportRow,
  type DeviceExportStore,
} from "@/lib/reality/device-export-write";

type Row = {
  id: string;
  athlete_id: string;
  provider: string;
  external_event_id: string | null;
  external_ref: string | null;
  status: string;
  sync_kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/**
 * Store in memoria che riproduce l'indice unico PARZIALE di produzione:
 * `uq_device_sync_exports_provider_event ON (provider, external_event_id) WHERE external_event_id IS NOT NULL`.
 */
function memoryStore(seed: Row[] = []) {
  const rows: Row[] = [...seed];
  let seq = seed.length;
  /** Quante volte la find deve «non vedere» la riga (simula la corsa fra pull concorrenti). */
  let blindFinds = 0;

  const store: DeviceExportStore = {
    async findByProviderExternalId({ provider, externalEventId }) {
      if (blindFinds > 0) {
        blindFinds -= 1;
        return null;
      }
      const hit = rows.find((r) => r.provider === provider && r.external_event_id === externalEventId);
      return hit ? { id: hit.id, athleteId: hit.athlete_id } : null;
    },
    async insert(row) {
      const extId = (row.external_event_id as string | null) ?? null;
      if (extId != null && rows.some((r) => r.provider === row.provider && r.external_event_id === extId)) {
        return {
          row: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "uq_device_sync_exports_provider_event"',
          },
        };
      }
      seq += 1;
      const created = String(row.created_at ?? `2026-09-08T00:0${seq}:00.000Z`);
      const stored: Row = {
        id: `row-${seq}`,
        athlete_id: String(row.athlete_id),
        provider: String(row.provider),
        external_event_id: extId,
        external_ref: (row.external_ref as string | null) ?? null,
        status: String(row.status),
        sync_kind: String(row.sync_kind),
        payload: row.payload as Record<string, unknown>,
        created_at: created,
        updated_at: created,
      };
      rows.push(stored);
      return { row: { ...stored }, error: null };
    },
    async updateById({ id, patch }) {
      const hit = rows.find((r) => r.id === id);
      if (!hit) return { row: null, error: { message: "riga inesistente" } };
      Object.assign(hit, patch);
      return { row: { ...hit }, error: null };
    },
  };

  return {
    store,
    rows,
    blindNextFind() {
      blindFinds += 1;
    },
  };
}

/** Riga come la costruisce `persistRealityDeviceExport` per un record WHOOP. */
function whoopInsertRow(input: {
  athleteId: string;
  externalEventId: string;
  recoveryScore: number;
  hrvMs: number;
}) {
  return {
    athlete_id: input.athleteId,
    provider: "whoop",
    external_ref: input.externalEventId,
    status: "created",
    sync_kind: "pull" as const,
    external_event_id: input.externalEventId,
    payload: {
      adapterKey: "whoop:recovery:api_sync",
      sourcePayload: {
        whoop_recovery: {
          cycle_id: 93845,
          score: { recovery_score: input.recoveryScore, hrv_rmssd_milli: input.hrvMs },
        },
      },
    },
  };
}

const ATLETA = "20529424-61d7-47c8-84df-9e9b221aaa49";
const ALTRO_ATLETA = "e9e8dc46-3ae6-412b-85e3-118b16aacb5b";

test("secondo pull dello stesso record WHOOP: update della riga esistente, non insert fallito", async () => {
  const { store, rows } = memoryStore();
  const extId = "whoop_cycle:93845";

  const primo = await writeDeviceSyncExportRow(store, {
    provider: "whoop",
    athleteId: ATLETA,
    externalEventId: extId,
    insertRow: whoopInsertRow({ athleteId: ATLETA, externalEventId: extId, recoveryScore: 41, hrvMs: 38.2 }),
  });
  assert.equal(primo.mode, "insert");

  // WHOOP rivede il proprio dato: recovery ricalcolata, HRV ri-punteggiata.
  const secondo = await writeDeviceSyncExportRow(store, {
    provider: "whoop",
    athleteId: ATLETA,
    externalEventId: extId,
    insertRow: whoopInsertRow({ athleteId: ATLETA, externalEventId: extId, recoveryScore: 67, hrvMs: 54.9 }),
    nowIso: "2026-09-08T10:00:00.000Z",
  });

  assert.equal(secondo.mode, "update");
  assert.equal(rows.length, 1, "nessuna riga duplicata");

  const score = (
    (rows[0].payload.sourcePayload as Record<string, Record<string, Record<string, number>>>).whoop_recovery
  ).score;
  assert.equal(score.recovery_score, 67, "la revisione del provider deve arrivare a destinazione");
  assert.equal(score.hrv_rmssd_milli, 54.9);
  assert.equal(rows[0].updated_at, "2026-09-08T10:00:00.000Z");
});

test("opt-out esplicito: torna all'insert secco e il doppione esplode", async () => {
  const { store } = memoryStore();
  const extId = "whoop_cycle:93845";
  await writeDeviceSyncExportRow(store, {
    provider: "whoop",
    athleteId: ATLETA,
    externalEventId: extId,
    insertRow: whoopInsertRow({ athleteId: ATLETA, externalEventId: extId, recoveryScore: 41, hrvMs: 38.2 }),
    dedupeOnExternalEventId: false,
  });

  await assert.rejects(
    () =>
      writeDeviceSyncExportRow(store, {
        provider: "whoop",
        athleteId: ATLETA,
        externalEventId: extId,
        insertRow: whoopInsertRow({ athleteId: ATLETA, externalEventId: extId, recoveryScore: 67, hrvMs: 54.9 }),
        dedupeOnExternalEventId: false,
      }),
    /duplicate key/,
  );
});

test("la riga di un altro atleta non viene MAI sovrascritta", async () => {
  const { store, rows } = memoryStore();
  const extId = "sleep:2026-08-04";

  await writeDeviceSyncExportRow(store, {
    provider: "polar",
    athleteId: ALTRO_ATLETA,
    externalEventId: extId,
    insertRow: {
      athlete_id: ALTRO_ATLETA,
      provider: "polar",
      external_ref: extId,
      external_event_id: extId,
      status: "created",
      sync_kind: "pull",
      payload: { sourcePayload: { polar_sleep: { date: "2026-08-04", owner: "primo" } } },
    },
  });

  await assert.rejects(
    () =>
      writeDeviceSyncExportRow(store, {
        provider: "polar",
        athleteId: ATLETA,
        externalEventId: extId,
        insertRow: {
          athlete_id: ATLETA,
          provider: "polar",
          external_ref: extId,
          external_event_id: extId,
          status: "created",
          sync_kind: "pull",
          payload: { sourcePayload: { polar_sleep: { date: "2026-08-04", owner: "secondo" } } },
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeviceExportOwnerConflictError);
      assert.equal(err.ownerAthleteId, ALTRO_ATLETA);
      assert.equal(err.requestedAthleteId, ATLETA);
      // il messaggio non deve somigliare a un doppione, o i runner lo inghiottono come `skipped`
      assert.doesNotMatch(err.message.toLowerCase(), /duplicate|unique|23505/);
      return true;
    },
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].athlete_id, ALTRO_ATLETA, "athlete_id invariato");
  assert.deepEqual(rows[0].payload, {
    sourcePayload: { polar_sleep: { date: "2026-08-04", owner: "primo" } },
  });
});

test("senza external_event_id resta insert puro (nessuna chiave su cui deduplicare)", async () => {
  const { store, rows } = memoryStore();
  const insertRow = {
    athlete_id: ATLETA,
    provider: "cgm",
    external_ref: null,
    external_event_id: null,
    status: "created",
    sync_kind: "pull",
    payload: { sourcePayload: { glucose: [1, 2, 3] } },
  };
  const a = await writeDeviceSyncExportRow(store, {
    provider: "cgm",
    athleteId: ATLETA,
    externalEventId: null,
    insertRow,
  });
  const b = await writeDeviceSyncExportRow(store, {
    provider: "cgm",
    athleteId: ATLETA,
    externalEventId: "   ",
    insertRow,
  });
  assert.equal(a.mode, "insert");
  assert.equal(b.mode, "insert");
  assert.equal(rows.length, 2);
});

test("corsa fra pull concorrenti: l'insert perde su 23505 e si ricade sull'update", async () => {
  const { store, rows, blindNextFind } = memoryStore();
  const extId = "whoop_cycle:99999";
  await writeDeviceSyncExportRow(store, {
    provider: "whoop",
    athleteId: ATLETA,
    externalEventId: extId,
    insertRow: whoopInsertRow({ athleteId: ATLETA, externalEventId: extId, recoveryScore: 30, hrvMs: 20 }),
  });

  blindNextFind();
  const esito = await writeDeviceSyncExportRow(store, {
    provider: "whoop",
    athleteId: ATLETA,
    externalEventId: extId,
    insertRow: whoopInsertRow({ athleteId: ATLETA, externalEventId: extId, recoveryScore: 88, hrvMs: 71 }),
  });

  assert.equal(esito.mode, "update");
  assert.equal(rows.length, 1);
});

test("shouldDedupeOnExternalEventId: default acceso, opt-out esplicito, mai senza chiave", () => {
  assert.equal(shouldDedupeOnExternalEventId({ externalEventId: "whoop:1" }), true);
  assert.equal(shouldDedupeOnExternalEventId({ externalEventId: "whoop:1", option: false }), false);
  assert.equal(shouldDedupeOnExternalEventId({ externalEventId: null }), false);
  assert.equal(shouldDedupeOnExternalEventId({ externalEventId: null, option: true }), false);
});

test("buildDeviceExportUpdatePatch: created_at solo se il chiamante lo impone", () => {
  const senza = buildDeviceExportUpdatePatch(
    { athlete_id: ATLETA, external_ref: "x", status: "created", sync_kind: "pull", payload: {} },
    "2026-09-08T10:00:00.000Z",
  );
  assert.equal("created_at" in senza, false);
  assert.equal(senza.updated_at, "2026-09-08T10:00:00.000Z");

  const con = buildDeviceExportUpdatePatch(
    {
      athlete_id: ATLETA,
      external_ref: "x",
      status: "created",
      sync_kind: "pull",
      payload: {},
      created_at: "2026-08-04T12:00:00.000Z",
    },
    "2026-09-08T10:00:00.000Z",
  );
  assert.equal(con.created_at, "2026-08-04T12:00:00.000Z");
});
