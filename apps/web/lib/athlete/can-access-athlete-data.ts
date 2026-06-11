import type { SupabaseClient } from "@supabase/supabase-js";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { coachOperationalApproved } from "@/lib/platform-coach-status";

/**
 * Gate unico atleta: **stesso significato** di `requireRequestAthleteAccess` (Pro 2).
 * - Platform admin (`is_platform_admin`) → accesso a ogni atleta (admin vede/modifica tutto,
 *   coerente con la policy DB `platform_admin_all` di migration 078).
 * - Profilo con `athlete_id` uguale al target → accesso (atleta “proprio”).
 * - Altrimenti solo **coach APPROVATO** (`platform_coach_status`) con riga in
 *   `coach_athletes` per `org_id` — un coach sospeso/in attesa non passa (audit B4).
 */
export async function canAccessAthleteData(
  client: SupabaseClient,
  userId: string,
  athleteId: string,
  orgId: string | null,
): Promise<boolean> {
  const { data: prof, error } = await client
    .from("app_user_profiles")
    .select("role, athlete_id, is_platform_admin, platform_coach_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !prof) return false;

  const p = prof as {
    role?: string;
    athlete_id?: string | null;
    is_platform_admin?: boolean | null;
    platform_coach_status?: string | null;
  };
  if (p.is_platform_admin === true) return true;

  const linkedAthleteId = typeof p.athlete_id === "string" ? p.athlete_id : null;
  if (linkedAthleteId === athleteId) return true;
  if (p.role !== "coach") return false;
  if (!coachOperationalApproved("coach", p.platform_coach_status ?? null)) return false;

  const resolvedOrg = orgId ?? coachOrgIdForDb();
  const { data: links, error: linkErr } = await client
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_user_id", userId)
    .eq("athlete_id", athleteId)
    .eq("org_id", resolvedOrg)
    .limit(1);
  if (linkErr) return false;
  return Boolean(links?.length);
}
