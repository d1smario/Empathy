import "server-only";

import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/app-session";
import { getSessionProfile } from "@/lib/auth/session-profile";

/**
 * Enforcement server-side del campo `roles` del registry nav (module-registry):
 * la sidebar nasconde le voci non pertinenti, ma senza questo guard l'URL diretto
 * aprirebbe comunque la pagina (es. utente su /athletes, coach su /settings).
 * Ruolo non consentito → redirect alla home di modulo (/dashboard).
 * Anonimo o Supabase assente (demo): nessun blocco — ci pensano paywall/athlete gate.
 */
export async function redirectIfShellRoleNotAllowed(allowedRoles?: AppRole[]): Promise<void> {
  if (!allowedRoles || allowedRoles.length === 0) return;

  const session = await getSessionProfile();
  if (!session.userId) return;

  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }
}
