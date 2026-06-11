/**
 * Tipi e helper condivisi per la gestione del catalogo prodotti admin.
 * Specchio della tabella `products` (migration 080) — zero hardcode di catalogo.
 */

export type ProductKind = "base" | "addon";
export type BillingInterval = "one_time" | "month" | "year";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  kind: ProductKind;
  price: number;
  currency: string;
  billing_interval: BillingInterval;
  duration_days: number | null;
  includes_own_coach: boolean;
  includes_empathy_coach: boolean;
  show_addons: boolean;
  commission_coach_amount: number | null;
  commission_coach_currency: string | null;
  commission_promoter_amount: number | null;
  commission_promoter_currency: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const KIND_LABEL: Record<ProductKind, string> = {
  base: "Base",
  addon: "Add-on",
};

export const INTERVAL_LABEL: Record<BillingInterval, string> = {
  month: "Mensile",
  year: "Annuale",
  one_time: "Una tantum",
};

/** Etichetta intervallo + durata, es. "Una tantum · 90 giorni". */
export function intervalLabel(interval: BillingInterval, durationDays: number | null): string {
  const base = INTERVAL_LABEL[interval] ?? interval;
  return durationDays ? `${base} · ${durationDays} giorni` : base;
}

/** Prezzo formattato it-CH; fallback grezzo se la valuta non è ISO. */
export function fmtPrice(price: number | null | undefined, currency: string | null | undefined): string {
  const n = Number(price);
  const cur = (currency ?? "CHF").trim() || "CHF";
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("it-CH", { style: "currency", currency: cur }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}
