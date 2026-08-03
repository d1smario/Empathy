import type { AlertKind } from "./athlete-alerts";

/**
 * Formattatori PURI della lista alert admin (`components/admin/alerts/AdminAlertsView.tsx`).
 * Vivono qui e non nel componente perché sono l'unica parte con dei casi veri da verificare
 * (payload eterogenei scritti dai writer) e così restano testabili con `tsx --test`, senza JSX.
 */

/** Profilo atleta ridotto ai campi che servono per dire DI CHI è l'alert. */
export type AlertAthleteLike = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

/**
 * Nome leggibile dell'atleta: nome+cognome, altrimenti email, altrimenti `null`
 * (il chiamante decide il fallback — qui non si inventa un'identità).
 */
export function formatAlertAthleteName(a: AlertAthleteLike | undefined | null): string | null {
  const name = [a?.first_name, a?.last_name]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join(" ")
    .trim();
  if (name) return name;
  const email = typeof a?.email === "string" ? a.email.trim() : "";
  return email || null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Riga di dettaglio dal payload scritto dai writer (`athlete-alerts.ts`): senza, l'admin
 * leggerebbe «sonno sotto il target» senza sapere di quanto. Difensiva per costruzione —
 * payload assente, campi mancanti o non numerici → `null`: la riga dell'alert resta valida,
 * solo più scarna. `sleep_missing` non ha dettaglio (il dato è, appunto, assente).
 */
export function formatAlertPayloadDetail(kind: AlertKind, payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;

  if (kind === "sleep_low") {
    const slept = num(payload.sleep_hours);
    const target = num(payload.target_hours);
    if (slept == null || target == null) return null;
    return `${slept.toFixed(1)} h dormite su ${target.toFixed(1)} h di target`;
  }

  if (kind === "training_over" || kind === "training_under") {
    const planned = num(payload.planned);
    const executed = num(payload.executed);
    if (planned == null || executed == null) return null;
    // `basis` è 'tss' | 'duration' (evaluateTrainingAlert): l'unità cambia il senso del numero.
    const unit = payload.basis === "duration" ? "min" : "TSS";
    return `${executed.toFixed(0)} ${unit} eseguiti su ${planned.toFixed(0)} pianificati`;
  }

  if (kind === "plan_adjusted") {
    const kinds = Array.isArray(payload.kinds)
      ? payload.kinds.filter((k): k is string => typeof k === "string" && k.trim() !== "")
      : [];
    return kinds.length > 0 ? kinds.join(" + ") : null;
  }

  return null;
}
