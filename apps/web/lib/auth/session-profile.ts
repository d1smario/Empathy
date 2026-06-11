import "server-only";

import { cache } from "react";
import type { AppRole } from "@/lib/app-session";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export type SessionProfileSnapshot = {
  userId: string | null;
  email: string;
  role: AppRole;
  isPlatformAdmin: boolean;
  athleteId: string | null;
  platformCoachStatus: string | null;
};

const ANONYMOUS: SessionProfileSnapshot = {
  userId: null,
  email: "",
  role: "private",
  isPlatformAdmin: false,
  athleteId: null,
  platformCoachStatus: null,
};

/**
 * Identità di sessione per i gate server, memoizzata PER RICHIESTA (React cache):
 * layout, pagina e qualunque guard nello stesso render condividono UN solo giro
 * `getUser` + select su `app_user_profiles`, invece di ripeterlo ciascuno.
 * Fonte di verità: il DB (role + is_platform_admin), mai env.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfileSnapshot> => {
  const supabase = createSupabaseCookieClient();
  if (!supabase) return ANONYMOUS;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return ANONYMOUS;

  const { data } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id, platform_coach_status, is_platform_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  const p = data as {
    role?: AppRole;
    athlete_id?: string | null;
    platform_coach_status?: string | null;
    is_platform_admin?: boolean | null;
  } | null;

  return {
    userId: user.id,
    email: user.email?.trim() ?? "",
    role: p?.role === "coach" ? "coach" : "private",
    isPlatformAdmin: p?.is_platform_admin === true,
    athleteId: typeof p?.athlete_id === "string" && p.athlete_id.length > 0 ? p.athlete_id : null,
    platformCoachStatus: p?.platform_coach_status ?? null,
  };
});
