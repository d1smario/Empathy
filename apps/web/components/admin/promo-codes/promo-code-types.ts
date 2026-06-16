/**
 * Tipi e helper condivisi per la gestione dei codici promo admin.
 * Specchio della tabella `promo_codes` (PASTE coach_codes/promo) — un solo
 * campo "codice" per due usi: sconto (percent/importo) e sblocco prodotto nascosto.
 */

export type PromoKind = "discount" | "unlock";
export type DiscountType = "percent" | "amount";

export type PromoCodeRow = {
  id: string;
  code: string;
  kind: PromoKind;
  /** Prodotto collegato: target dello sblocco ('unlock') o vincolo dello sconto. */
  target_product_id: string | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  discount_currency: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const PROMO_KIND_LABEL: Record<PromoKind, string> = {
  discount: "Sconto",
  unlock: "Sblocco",
};

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = {
  percent: "Percentuale",
  amount: "Importo fisso",
};

/** Descrizione sintetica dell'effetto, es. "-20%", "-30 CHF", "Sblocco prodotto". */
export function promoEffectLabel(p: PromoCodeRow): string {
  if (p.kind === "unlock") return "Sblocca prodotto nascosto";
  const value = Number(p.discount_value) || 0;
  if (p.discount_type === "amount") {
    return `-${value} ${(p.discount_currency ?? "CHF").toUpperCase()}`;
  }
  return `-${value}%`;
}

export function fmtPromoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

/** "3 / 100" oppure "3 / ∞" se non c'è un massimo. */
export function fmtRedemptions(p: PromoCodeRow): string {
  const used = Number(p.redemption_count) || 0;
  const max = p.max_redemptions;
  return `${used} / ${max == null ? "∞" : max}`;
}
