import type { AlertKind } from "./athlete-alerts";

/**
 * Helper CLIENT-safe condivisi dalle UI degli alert (strip atleta su Oggi, badge coach
 * in dashboard): finestra «freschi» e formattazione orario. Nessun import server-only.
 */

export const ALERT_KINDS: readonly AlertKind[] = [
  "sleep_low",
  "training_over",
  "training_under",
  "plan_adjusted",
  "sleep_missing",
];

export function isAlertKind(v: unknown): v is AlertKind {
  return typeof v === "string" && (ALERT_KINDS as readonly string[]).includes(v);
}

/** ISO di 48 ore fa: finestra condivisa atleta/coach per gli alert non letti. */
export function alertsSinceIso(): string {
  return new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
}

/** "07:45" se oggi, altrimenti "mar 07:45": l'orario REALE dell'evento (created_at), compatto. */
export function formatAlertTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(locale, {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
