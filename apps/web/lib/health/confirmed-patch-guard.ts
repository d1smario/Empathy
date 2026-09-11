/**
 * Che cosa può entrare nel referto al momento della conferma.
 *
 * La conferma scrive con privilegi di servizio su tabelle che la RLS al singolo utente nega.
 * Il client manda l'elenco dei valori confermati, e fino a oggi quell'elenco non veniva
 * confrontato con la proposta: chi confermava poteva aggiungere campi mai proposti. Finché
 * confermava solo un coach approvato il rischio era contenuto; da quando conferma chi inserisce
 * — atleta compreso — non lo è più. Un `health_score_totale: 100` aggiunto a mano, per dire,
 * verrebbe letto dal calcolo dei punteggi come un punteggio dichiarato dal laboratorio.
 *
 * Quattro regole:
 *  1. si confermano SOLO i campi presenti nella proposta;
 *  2. un valore numerico resta numerico;
 *  3. se è stato corretto, deve stare nell'intervallo di plausibilità del marcatore — la stessa
 *     regola dell'inserimento manuale — quando lo conosciamo;
 *  4. l'unità è quella della proposta: la conferma corregge il numero, non cambia la scala.
 *
 * Pura: nessun import di rete o di Next, testabile con `node:test`.
 */

export type ConfirmedPatchInput = {
  field: string;
  value: number | string | null;
  /** Ignorata: l'unità viene sempre dalla proposta. */
  unit?: string | null;
  confidence?: number;
};

/** In uscita l'unità c'è sempre, ed è quella della proposta. */
export type ConfirmedPatchOutput = {
  field: string;
  value: number | string | null;
  unit: string | null;
  confidence?: number;
};

export type PlausibleRange = { min: number; max: number };

export type ConfirmedPatchGuardFailureCode =
  | "field_not_proposed"
  | "value_missing"
  | "value_not_numeric"
  | "value_implausible";

export type ConfirmedPatchGuardResult =
  | { ok: true; patches: ConfirmedPatchOutput[] }
  | { ok: false; code: ConfirmedPatchGuardFailureCode; field: string; error: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const normField = (f: unknown) => String(f ?? "").trim().toLowerCase();

export function guardConfirmedPatches(
  confirmed: readonly ConfirmedPatchInput[],
  proposed: readonly unknown[],
  plausibleRangeFor: (field: string) => PlausibleRange | null = () => null,
): ConfirmedPatchGuardResult {
  const proposedByField = new Map<string, { value: unknown; unit: string | null }>();
  for (const raw of proposed) {
    const rec = asRecord(raw);
    const field = normField(rec?.field);
    if (!field || proposedByField.has(field)) continue;
    const value = rec?.proposed_value !== undefined ? rec?.proposed_value : rec?.value;
    const unit = typeof rec?.unit === "string" && rec.unit.trim() ? rec.unit.trim() : null;
    proposedByField.set(field, { value, unit });
  }

  const out: ConfirmedPatchOutput[] = [];
  const seen = new Set<string>();
  for (const c of confirmed) {
    const field = normField(c.field);
    if (!field || seen.has(field)) continue; // un campo si conferma una volta: vince la prima
    seen.add(field);

    const prop = proposedByField.get(field);
    if (!prop) {
      return {
        ok: false,
        code: "field_not_proposed",
        field,
        error: `«${field}» non era fra i valori proposti: la conferma non può aggiungere campi.`,
      };
    }
    if (c.value == null || (typeof c.value === "string" && c.value.trim() === "")) {
      return { ok: false, code: "value_missing", field, error: `Manca il valore di «${field}».` };
    }

    const proposedNumber = toFiniteNumber(prop.value);
    if (proposedNumber == null) {
      // Proposta non numerica (casi storici): passa com'è, nell'unità della proposta.
      out.push({ field, value: c.value, unit: prop.unit, confidence: c.confidence });
      continue;
    }

    const value = toFiniteNumber(c.value);
    if (value == null) {
      return { ok: false, code: "value_not_numeric", field, error: `«${field}» deve restare un numero.` };
    }
    if (value !== proposedNumber) {
      const range = plausibleRangeFor(field);
      if (range && (value < range.min || value > range.max)) {
        return {
          ok: false,
          code: "value_implausible",
          field,
          error: `«${field}» = ${value} è fuori dall'intervallo plausibile (${range.min}–${range.max}): controlla il numero.`,
        };
      }
    }
    out.push({ field, value, unit: prop.unit, confidence: c.confidence });
  }
  return { ok: true, patches: out };
}
