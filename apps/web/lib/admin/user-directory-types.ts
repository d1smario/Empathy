import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import type { AdminAthleteActivityRollup } from "@/lib/admin/load-activity-rollups";

export type AdminDirectoryStripeRow = {
  status: string;
  currentPeriodEnd: string | null;
  basePlanId: string | null;
};

export type AdminDirectoryUserRow = {
  userId: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  role: "private" | "coach" | null;
  platformCoachStatus: string | null;
  isPlatformAdmin: boolean;
  athleteId: string | null;
  /** Email dei coach collegati all'atleta via `coach_athletes` (vuoto se nessuno). */
  coachEmails: string[];
  stripeSubscriptions: AdminDirectoryStripeRow[];
  entitlement: UserAccessEntitlement;
  activity: AdminAthleteActivityRollup | null;
};

/** Anagrafica fatturazione (`user_billing_profiles`, migration 077) esposta dall'API detail. */
export type AdminUserAnagraficaRow = {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  phone: string | null;
  updatedAt: string | null;
};

/**
 * Stato funnel utente per la tabella clienti admin.
 * Derivato da ruolo + sottoscrizioni Stripe: admin > coach > cliente (active) > prova (trialing) > registrato.
 */
export type AdminUserFunnelStatus = "admin" | "coach" | "cliente" | "prova" | "registrato";

export function adminUserFunnelStatus(row: {
  isPlatformAdmin: boolean;
  role: "private" | "coach" | null;
  stripeSubscriptions: Array<{ status: string }>;
}): AdminUserFunnelStatus {
  if (row.isPlatformAdmin) return "admin";
  if (row.role === "coach") return "coach";
  if (row.stripeSubscriptions.some((s) => s.status === "active")) return "cliente";
  if (row.stripeSubscriptions.some((s) => s.status === "trialing")) return "prova";
  return "registrato";
}
