import "server-only";

import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";

/**
 * Confina il platform admin nella sua area: se l'utente della sessione ha
 * `is_platform_admin = true`, qualunque rotta della shell utente/coach
 * reindirizza a `/admin`. Specchio del gate in `app/admin/layout.tsx`
 * (che rimanda i non-admin alla loro home). Nessuna UI condivisa tra i due mondi.
 */
export async function redirectPlatformAdminToConsole(): Promise<void> {
  const session = await getSessionProfile();
  if (session.isPlatformAdmin) {
    redirect("/admin");
  }
}
