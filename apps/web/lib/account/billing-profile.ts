/**
 * Anagrafica fatturazione (`user_billing_profiles`, migration 077) — lato utente.
 * Campi richiesti per l'acquisto: in Svizzera fattura/ricevuta vogliono
 * intestatario e indirizzo completi.
 */

export type BillingProfileRow = {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  vat_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country_code: string | null;
  phone: string | null;
};

export const BILLING_REQUIRED_FIELDS: (keyof BillingProfileRow)[] = [
  "first_name",
  "last_name",
  "address_line1",
  "postal_code",
  "city",
  "country_code",
];

export function isBillingProfileComplete(row: Partial<BillingProfileRow> | null | undefined): boolean {
  if (!row) return false;
  return BILLING_REQUIRED_FIELDS.every((f) => {
    const v = row[f];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Evento custom per aprire il modale anagrafica (icona profilo in alto a destra). */
export const OPEN_BILLING_PROFILE_EVENT = "empathy:billing-profile:open";
