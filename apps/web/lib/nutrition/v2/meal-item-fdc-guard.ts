/**
 * Guardia sulla foreign key `meal_item.fdc_id → fdc_food(fdc_id)`.
 *
 * Il motore sceglie gli alimenti dal catalogo `nutrition_menu_foods`, le cui composizioni
 * stanno in `nutrition_fdc_foods` — che è un SOVRAINSIEME di `fdc_food` (contiene anche
 * righe CIQUAL con fdc_id sintetico 900000000+codice). Le voci del giorno si scrivono in un
 * colpo solo, quindi un SOLO alimento che la FK rifiuta faceva cadere l'INTERO insert:
 * restavano i `meal` (senza quella FK) con ZERO `meal_item` → pagina Nutrizione piena
 * (legge `nutrition_plan.response_payload`) e pagina Oggi vuota (legge meal/meal_item).
 *
 * La riparazione NON scarta il cibo: gli azzera solo il riferimento FDC. Una riga con
 * `fdc_id` NULL è legittima (la FK non tocca i NULL, e in prod esistono già righe così) e
 * Oggi la mostra lo stesso usando `label` + `canonical_key`. Così l'alimento difettoso
 * perde l'immagine da `fdc_food`, non il posto nel piatto — e non esiste nessun caso in cui
 * la guardia possa svuotare la giornata.
 * Modulo PURO — nessun accesso al DB — così la regola è testabile senza Supabase.
 */

/** Campi che bastano alla guardia; il chiamante ci appende il resto della riga. */
export type PendingMealItem = {
  /** Slot di appartenenza: serve solo alla traccia, per dire QUALE pasto ha perso il legame FDC. */
  slot: string;
  /** fdc_id già risolto (alias canonico incluso). NULL = riga senza FDC, legittima. */
  fdcId: number | null;
  label: string | null;
  canonicalKey: string | null;
};

/** Voce a cui la guardia ha tolto il riferimento FDC (il cibo resta, il legame no). */
export type ClearedFdcRef = {
  slot: string;
  fdcId: number;
  label: string | null;
  canonicalKey: string | null;
};

export type MealItemFdcGuardResult<T extends PendingMealItem> = {
  /** TUTTE le voci, nell'ordine originale: quelle irrisolvibili con `fdcId` azzerato. */
  rows: T[];
  cleared: ClearedFdcRef[];
};

function positiveFdcId(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Gli fdc_id da verificare contro la tabella bersaglio della FK, deduplicati: una sola
 * query `in(...)` per giornata invece di un tentativo di insert per riga.
 */
export function candidateFdcIdsForFkCheck(items: readonly PendingMealItem[]): number[] {
  const ids = new Set<number>();
  for (const item of items) {
    const id = positiveFdcId(item.fdcId);
    if (id !== null) ids.add(id);
  }
  return [...ids];
}

/**
 * Azzera il `fdcId` delle voci che la FK rifiuterebbe, senza toglierle dalla lista.
 * Una voce con fdc_id NULL (staple canonico senza alias FDC, es. `chicken_breast`) NON è un
 * errore: la FK non si applica ai NULL e quelle righe sono già la lista-cibi completa che
 * Oggi mostra con label + canonical_key. Il conteggio delle voci in uscita è SEMPRE uguale a
 * quello in ingresso: nessun input può produrre una giornata vuota.
 */
export function clearUnknownFdcIds<T extends PendingMealItem>(
  items: readonly T[],
  knownFdcIds: ReadonlySet<number>,
): MealItemFdcGuardResult<T> {
  const rows: T[] = [];
  const cleared: ClearedFdcRef[] = [];
  for (const item of items) {
    const id = positiveFdcId(item.fdcId);
    if (id === null || knownFdcIds.has(id)) {
      rows.push(item);
      continue;
    }
    rows.push({ ...item, fdcId: null });
    cleared.push({ slot: item.slot, fdcId: id, label: item.label, canonicalKey: item.canonicalKey });
  }
  return { rows, cleared };
}

/** Tetto alla traccia: `inputs_provenance` è jsonb di servizio, non un log. */
const CLEARED_TRACE_LIMIT = 24;

export type MealItemFdcClearedTrace = {
  reason: "fdc_id_missing_in_fdc_food";
  cleared_count: number;
  /** Snake_case: è un payload jsonb interrogabile, non un oggetto TS di dominio. */
  cleared: Array<{ slot: string; fdc_id: number; label: string | null; canonical_key: string | null }>;
};

/**
 * Traccia da persistere in `nutrition_plan.inputs_provenance.meal_item_fdc_cleared`: chi
 * guarda deve poter sapere che quel giorno ha perso dei legami FDC e QUALI (sono i cibi da
 * riportare in `fdc_food`). `null` quando non si è azzerato niente, così la provenienza resta
 * identica a prima nel caso normale.
 */
export function mealItemFdcClearedTrace(cleared: readonly ClearedFdcRef[]): MealItemFdcClearedTrace | null {
  if (cleared.length === 0) return null;
  return {
    reason: "fdc_id_missing_in_fdc_food",
    cleared_count: cleared.length,
    cleared: cleared.slice(0, CLEARED_TRACE_LIMIT).map((c) => ({
      slot: c.slot,
      fdc_id: c.fdcId,
      label: c.label,
      canonical_key: c.canonicalKey,
    })),
  };
}
