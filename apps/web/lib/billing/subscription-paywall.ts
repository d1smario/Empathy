import "server-only";

import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";
import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { loadBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { ACCESS_PLAN_PATH, isPaywallEnforced } from "@/lib/billing/paywall-config";

export { isPaywallEnforced };

/**
 * Server-side gate per il layout (shell)/.
 * Solo lettura DB — niente Stripe qui (evita crash/timeout al login).
 */
export async function gateAuthenticatedShellAccessOrRedirect(): Promise<UserAccessEntitlement | null> {
  /**
   * Flag spenta → zero query: il gate non può comunque reindirizzare e nessun
   * caller usa il valore di ritorno. Evita getUser + entitlement (3-4 query
   * Supabase) su OGNI render della shell quando il paywall non è attivo.
   */
  if (!isPaywallEnforced()) return null;

  /** Identità dalla cache per-request (getSessionProfile): il layout la risolve
      già — qui il gate faceva un SECONDO getUser HTTP in serie (audit 2026-07). */
  const session = await getSessionProfile();
  if (!session.userId) return null;

  const entitlement = await loadBillingEntitlementForAuthUser(session.userId);

  if (entitlement.hasAthleteAccess || entitlement.hasOperatorAccess) {
    return entitlement;
  }

  redirect(`${ACCESS_PLAN_PATH}?required=subscription`);
}
