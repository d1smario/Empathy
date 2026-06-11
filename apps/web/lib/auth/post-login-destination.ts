import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";
import { safeAppInternalPath } from "@/core/routing/guards";
import { preferMobileAppPath } from "@/core/navigation/mobile-module-registry";
import { ACCESS_PLAN_PATH } from "@/lib/billing/paywall-config";

/**
 * Destinazioni sicure subito dopo login: hub operativi che non montano viste pesanti
 * (calendario, physiology lab, builder con query) prima che contesto atleta e cookie siano stabili.
 */
const POST_LOGIN_SAFE_PATHS = new Set([
  "/dashboard",
  "/m/dashboard",
  "/profile",
  "/m/profile",
  "/settings",
  "/m/settings",
  "/athletes",
  ACCESS_PLAN_PATH,
]);

export type PostLoginDestinationInput = {
  /** `next` già validato con `safeAppInternalPath` lato caller se serve. */
  next: string;
  appRole: PendingAppRole;
  hasAthleteAccess: boolean;
  hasOperatorAccess: boolean;
  /** Platform admin (`is_platform_admin`): porta unica → console `/admin`, ha priorità su tutto. */
  isPlatformAdmin?: boolean;
  /** Su telefono/tablet: hub sicuri → equivalente `/m/*`. */
  preferMobile?: boolean;
};

/**
 * Dove mandare l'utente dopo auth riuscita (password, magic link callback, sessione già attiva su `/access`).
 * Porta unica per identità: admin → `/admin` (→ Dashboard admin); coach / operator → Dashboard;
 * atleta senza entitlement → gate piano; atleta con accesso → dashboard (salvo `next` sicuro).
 */
export function resolvePostLoginDestination(input: PostLoginDestinationInput): string {
  // Invito coach (atleta→coach): chi arriva da /coach-invite/[token] deve tornare
  // all'invito dopo il login, qualunque sia il ruolo (la pagina è pubblica).
  if (typeof input.next === "string" && input.next.startsWith("/coach-invite/")) {
    return input.next;
  }

  const next = safeAppInternalPath(input.next, "/dashboard");
  const preferMobile = input.preferMobile === true;

  // Admin di piattaforma: console dedicata, nessun equivalente mobile.
  if (input.isPlatformAdmin === true) {
    return "/admin";
  }

  if (input.appRole === "coach" || input.hasOperatorAccess) {
    // Coach: si entra dalla Dashboard (gli atleti restano a un click in sidebar).
    return "/dashboard";
  }

  if (!input.hasAthleteAccess) {
    return ACCESS_PLAN_PATH;
  }

  const base = (next.split("?")[0] ?? "/").replace(/\/$/, "") || "/";
  if (base === ACCESS_PLAN_PATH) {
    return preferMobileAppPath("/dashboard", preferMobile);
  }
  if (POST_LOGIN_SAFE_PATHS.has(base)) {
    return preferMobileAppPath(next, preferMobile);
  }

  return preferMobileAppPath("/dashboard", preferMobile);
}
