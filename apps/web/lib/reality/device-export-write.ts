/**
 * Scrittura di UNA riga `device_sync_exports` con deduplica su `(provider, external_event_id)`.
 *
 * Perché esiste questo file: la deduplica non può restare «per eccezione». Prima, chi non passava
 * l'opzione faceva `.insert()` secco e ogni record già visto sbatteva sull'indice unico parziale
 * `uq_device_sync_exports_provider_event`; l'errore veniva intercettato dal runner e contato come
 * `skipped`. Conseguenza vera: le righe esistenti non venivano MAI aggiornate, quindi le revisioni
 * del provider (WHOOP ricalcola recovery e ri-punteggia il sonno) non arrivavano mai a destinazione.
 *
 * Il modulo non conosce Supabase: parla con una porta (`DeviceExportStore`) così la logica di merge
 * è testabile senza DB.
 */

export type DeviceSyncExportRow = Record<string, unknown>;

export type DeviceExportWriteError = { message: string; code?: string | null } | null;

export type DeviceExportExisting = { id: string; athleteId: string };

export type DeviceExportStore = {
  /** Cerca la riga già presente per la chiave dell'indice unico. */
  findByProviderExternalId(input: {
    provider: string;
    externalEventId: string;
  }): Promise<DeviceExportExisting | null>;
  insert(row: Record<string, unknown>): Promise<{ row: DeviceSyncExportRow | null; error: DeviceExportWriteError }>;
  updateById(input: {
    id: string;
    patch: Record<string, unknown>;
  }): Promise<{ row: DeviceSyncExportRow | null; error: DeviceExportWriteError }>;
};

/**
 * Sollevata quando `(provider, external_event_id)` esiste già ma appartiene a un ALTRO atleta.
 * Non si aggiorna mai la riga di un altro atleta: meglio un errore rumoroso che un travaso di dati.
 * Il messaggio evita di proposito le parole «duplicate/unique/23505» così i runner non lo
 * scambiano per un banale doppione e lo riportano fra gli errori.
 */
export class DeviceExportOwnerConflictError extends Error {
  readonly provider: string;
  readonly externalEventId: string;
  readonly ownerAthleteId: string;
  readonly requestedAthleteId: string;

  constructor(input: {
    provider: string;
    externalEventId: string;
    ownerAthleteId: string;
    requestedAthleteId: string;
  }) {
    super(
      `device_sync_export_external_event_id_owner_conflict: ${input.provider}/${input.externalEventId} appartiene all'atleta ${input.ownerAthleteId}, richiesto ${input.requestedAthleteId}`,
    );
    this.name = "DeviceExportOwnerConflictError";
    this.provider = input.provider;
    this.externalEventId = input.externalEventId;
    this.ownerAthleteId = input.ownerAthleteId;
    this.requestedAthleteId = input.requestedAthleteId;
  }
}

export function isUniqueViolationError(error: DeviceExportWriteError): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|unique constraint|violates unique constraint/i.test(error.message ?? "");
}

/** Normalizza `externalRef` → `external_event_id` usabile (stringa non vuota) oppure `null`. */
export function normalizeExternalEventId(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

/**
 * Deduplica attiva? Sì ogni volta che c'è un `external_event_id`, salvo opt-out esplicito.
 * Difesa strutturale: se ci si può dimenticare di attivarla, prima o poi ci si dimentica —
 * ed è esattamente quello che è successo a sei runner su sette.
 */
export function shouldDedupeOnExternalEventId(input: {
  externalEventId: string | null;
  option?: boolean;
}): boolean {
  if (!input.externalEventId) return false;
  return input.option ?? true;
}

/** Campi che una nuova versione del record dal provider deve poter sovrascrivere. */
export function buildDeviceExportUpdatePatch(
  insertRow: Record<string, unknown>,
  nowIso: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    athlete_id: insertRow.athlete_id,
    external_ref: insertRow.external_ref,
    status: insertRow.status,
    sync_kind: insertRow.sync_kind,
    payload: insertRow.payload,
    updated_at: nowIso,
  };
  if (insertRow.created_at !== undefined) patch.created_at = insertRow.created_at;
  return patch;
}

export type DeviceExportWriteResult = {
  mode: "insert" | "update";
  row: DeviceSyncExportRow | null;
};

/**
 * Insert, oppure update della riga già presente con la stessa `(provider, external_event_id)`.
 * `.upsert(onConflict:…)` non è utilizzabile: l'indice unico è PARZIALE
 * (`WHERE external_event_id IS NOT NULL`) e Postgres non lo inferisce per ON CONFLICT.
 */
export async function writeDeviceSyncExportRow(
  store: DeviceExportStore,
  input: {
    provider: string;
    athleteId: string;
    externalEventId: string | null;
    insertRow: Record<string, unknown>;
    dedupeOnExternalEventId?: boolean;
    nowIso?: string;
  },
): Promise<DeviceExportWriteResult> {
  const externalEventId = normalizeExternalEventId(input.externalEventId);
  const dedupe = shouldDedupeOnExternalEventId({
    externalEventId,
    option: input.dedupeOnExternalEventId,
  });

  if (!dedupe || !externalEventId) {
    const ins = await store.insert(input.insertRow);
    if (ins.error) throw new Error(ins.error.message);
    return { mode: "insert", row: ins.row };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const patch = buildDeviceExportUpdatePatch(input.insertRow, nowIso);

  const existing = await store.findByProviderExternalId({ provider: input.provider, externalEventId });
  if (existing) {
    assertSameOwner({ existing, input, externalEventId });
    const up = await store.updateById({ id: existing.id, patch });
    if (up.error) throw new Error(up.error.message);
    return { mode: "update", row: up.row };
  }

  const ins = await store.insert(input.insertRow);
  if (!ins.error) return { mode: "insert", row: ins.row };
  if (!isUniqueViolationError(ins.error)) throw new Error(ins.error.message);

  // Corsa fra due pull concorrenti: la riga è comparsa fra la SELECT e l'INSERT.
  const raced = await store.findByProviderExternalId({ provider: input.provider, externalEventId });
  if (!raced) throw new Error(ins.error.message);
  assertSameOwner({ existing: raced, input, externalEventId });
  const up = await store.updateById({ id: raced.id, patch });
  if (up.error) throw new Error(up.error.message);
  return { mode: "update", row: up.row };
}

function assertSameOwner(args: {
  existing: DeviceExportExisting;
  input: { provider: string; athleteId: string };
  externalEventId: string;
}): void {
  if (args.existing.athleteId === args.input.athleteId) return;
  throw new DeviceExportOwnerConflictError({
    provider: args.input.provider,
    externalEventId: args.externalEventId,
    ownerAthleteId: args.existing.athleteId,
    requestedAthleteId: args.input.athleteId,
  });
}
