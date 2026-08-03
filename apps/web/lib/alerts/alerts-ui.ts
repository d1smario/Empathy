import { Moon, MoonStar, TrendingDown, TrendingUp, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { AlertKind } from "./athlete-alerts";

/**
 * Helper CLIENT-safe condivisi dalle UI degli alert (strip atleta su Oggi, badge coach
 * in dashboard, lista coach su Atleti, lista admin): finestra «freschi», formattazione
 * orario e look per tipo. Nessun import server-only.
 *
 * NB: qui c'è un import di lucide (componenti icona). La lettura PURA del payload sta in
 * `alert-facts.ts` proprio per restare importabile dai test `tsx --test` senza React.
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

/**
 * Icona + tono per tipo di alert: UNA sola definizione per tutte le superfici (strip Oggi,
 * lista coach, lista admin). Era duplicata riga per riga in due componenti e stava per
 * diventare tre: lo stesso `sleep_low` deve essere viola ovunque, o il coach e l'atleta
 * guardano lo stesso avviso con due colori diversi.
 *
 * Qui NON c'è la label: la danno `t()` (atleta/coach, voci diverse) o la copia hardcoded
 * dell'admin — la stessa kind si racconta in prima o terza persona a seconda di chi legge.
 */
export const ALERT_KIND_META: Record<AlertKind, { icon: LucideIcon; tone: string }> = {
  sleep_low: { icon: Moon, tone: "border-violet-400/30 bg-violet-500/10 text-violet-200" },
  training_over: { icon: TrendingUp, tone: "border-orange-400/30 bg-orange-500/10 text-orange-200" },
  training_under: { icon: TrendingDown, tone: "border-sky-400/30 bg-sky-500/10 text-sky-200" },
  plan_adjusted: { icon: UtensilsCrossed, tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" },
  sleep_missing: { icon: MoonStar, tone: "border-amber-400/30 bg-amber-500/10 text-amber-200" },
};

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
