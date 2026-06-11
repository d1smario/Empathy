import "server-only";

import { resolvePlatformAdminAccess } from "@/lib/platform-admin";
import { getSessionProfile } from "@/lib/auth/session-profile";

export type PlatformAdminSession = {
  userId: string;
  email: string;
};

/**
 * Sessione Supabase cookie + admin: fonte di verità SOLO il DB
 * (`app_user_profiles.is_platform_admin`). L'email serve unicamente per l'audit
 * (es. `granted_by_email` sui grant), non è una condizione d'accesso.
 * Identità letta da `getSessionProfile` (memoizzata per richiesta).
 */
export async function requirePlatformAdminSession(): Promise<PlatformAdminSession | null> {
  const session = await getSessionProfile();
  if (!session.userId) return null;
  if (!resolvePlatformAdminAccess({ profileIsAdmin: session.isPlatformAdmin })) return null;
  return { userId: session.userId, email: session.email };
}
