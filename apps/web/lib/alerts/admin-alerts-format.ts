import type { AlertKind } from "./athlete-alerts";
import { alertPayloadFacts } from "./alert-facts";

/**
 * Formattatori PURI della lista alert admin (`components/admin/alerts/AdminAlertsView.tsx`).
 * Vivono qui e non nel componente perché sono l'unica parte con dei casi veri da verificare
 * (payload eterogenei scritti dai writer) e così restano testabili con `tsx --test`, senza JSX.
 *
 * La LETTURA del payload sta invece in `alert-facts.ts`: la condivide il pannello coach, che
 * però compone le stesse cifre con `t()` (IT/EN). Qui resta solo la resa in italiano, perché
 * l'area admin non è tradotta.
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

/**
 * Riga di dettaglio dal payload scritto dai writer (`athlete-alerts.ts`): senza, l'admin
 * leggerebbe «sonno sotto il target» senza sapere di quanto. I casi limite (payload assente,
 * campi mancanti o non numerici → `null`) li gestisce `alertPayloadFacts`: qui si formatta
 * e basta, così admin e coach non possono divergere sul COSA leggono dal payload.
 */
export function formatAlertPayloadDetail(kind: AlertKind, payload: Record<string, unknown> | null): string | null {
  const facts = alertPayloadFacts(kind, payload);
  if (!facts) return null;

  if (facts.detail === "sleep") {
    return `${facts.sleptHours.toFixed(1)} h dormite su ${facts.targetHours.toFixed(1)} h di target`;
  }

  if (facts.detail === "training") {
    const unit = facts.basis === "duration" ? "min" : "TSS";
    return `${facts.executed.toFixed(0)} ${unit} eseguiti su ${facts.planned.toFixed(0)} pianificati`;
  }

  return facts.kinds.join(" + ");
}
