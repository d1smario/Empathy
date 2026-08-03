import type { AlertKind } from "./athlete-alerts";

/**
 * Lettura PURA del payload di un alert → fatti STRUTTURATI (numeri, non frasi).
 *
 * Perché separato dalle stringhe: lo stesso payload va reso in due voci diverse.
 * L'area admin stampa italiano hardcoded (`admin-alerts-format.ts`, non tradotta),
 * il pannello coach compone con `t()` in IT/EN. Se il dettaglio uscisse già come
 * frase montata, la lista del coach in inglese avrebbe righe in italiano.
 *
 * Nessun import a runtime (solo il type): resta testabile con `tsx --test` senza
 * trascinarsi dentro React/lucide.
 */

/** Payload eterogenei scritti dai writer: i numeri arrivano anche come stringhe dal jsonb. */
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export type AlertFacts =
  | { detail: "sleep"; sleptHours: number; targetHours: number }
  /** `basis` viene da evaluateTrainingAlert: cambia l'unità, quindi il senso dei numeri. */
  | { detail: "training"; executed: number; planned: number; basis: "tss" | "duration" }
  | { detail: "adjustments"; kinds: string[] };

/**
 * Difensiva per costruzione — payload assente, campi mancanti o non numerici → `null`:
 * la riga dell'alert resta valida, solo più scarna. `sleep_missing` non ha dettaglio
 * (il dato è, appunto, assente).
 */
export function alertPayloadFacts(kind: AlertKind, payload: Record<string, unknown> | null): AlertFacts | null {
  if (!payload) return null;

  if (kind === "sleep_low") {
    const sleptHours = num(payload.sleep_hours);
    const targetHours = num(payload.target_hours);
    if (sleptHours == null || targetHours == null) return null;
    return { detail: "sleep", sleptHours, targetHours };
  }

  if (kind === "training_over" || kind === "training_under") {
    const planned = num(payload.planned);
    const executed = num(payload.executed);
    if (planned == null || executed == null) return null;
    return { detail: "training", executed, planned, basis: payload.basis === "duration" ? "duration" : "tss" };
  }

  if (kind === "plan_adjusted") {
    const kinds = Array.isArray(payload.kinds)
      ? payload.kinds.filter((k): k is string => typeof k === "string" && k.trim() !== "")
      : [];
    return kinds.length > 0 ? { detail: "adjustments", kinds } : null;
  }

  return null;
}
