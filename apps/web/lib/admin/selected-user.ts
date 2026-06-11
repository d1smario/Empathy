import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminSelectedUser = {
  userId: string;
  email: string | null;
  role: "private" | "coach";
  isPlatformAdmin: boolean;
  athleteId: string | null;
};

/**
 * Identità dell'utente selezionato nelle rotte `/admin/utenti/[userId]/...`.
 * Lettura via service role (il gate admin è nel layout); memoizzata per richiesta
 * così layout/pagina/moduli condividono un solo giro. `null` = utente inesistente.
 */
export const getAdminSelectedUser = cache(async (userId: string): Promise<AdminSelectedUser | null> => {
  const id = userId.trim();
  if (!id) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: authUser, error } = await admin.auth.admin.getUserById(id);
  if (error || !authUser?.user) return null;

  const { data: profile } = await admin
    .from("app_user_profiles")
    .select("role, athlete_id, is_platform_admin")
    .eq("user_id", id)
    .maybeSingle();

  const p = profile as { role?: string; athlete_id?: string | null; is_platform_admin?: boolean | null } | null;
  return {
    userId: id,
    email: authUser.user.email ?? null,
    role: p?.role === "coach" ? "coach" : "private",
    isPlatformAdmin: p?.is_platform_admin === true,
    athleteId: typeof p?.athlete_id === "string" && p.athlete_id.length > 0 ? p.athlete_id : null,
  };
});
