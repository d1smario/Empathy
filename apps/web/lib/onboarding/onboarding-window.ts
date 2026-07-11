import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAccessEntitlementsForUserIds } from "@/lib/billing/access-entitlement";

/**
 * Inizio della finestra onboarding/piano di un atleta: `plan_started_at` (acquisto/attivazione)
 * con fallback deterministico a `created_at`. Usato dai cron M2 (mail) e M3 (generazione).
 */
export function resolvePlanWindowStartIso(row: {
  plan_started_at?: unknown;
  created_at?: unknown;
}): string | null {
  const ps = typeof row.plan_started_at === "string" && row.plan_started_at.trim() ? row.plan_started_at : null;
  if (ps) return ps;
  return typeof row.created_at === "string" ? row.created_at : null;
}

/**
 * Sottoinsieme di `athleteIds` che ha diritto d'uso come atleta (prova Stripe / abbonamento /
 * grant / admin), via il risolutore entitlement canonico. Mappa athlete_id → user_id attraverso
 * app_user_profiles. I cron devono processare SOLO gli atleti entitled.
 */
export async function loadEntitledAthleteIds(
  db: SupabaseClient,
  athleteIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(athleteIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const { data: profiles } = await db
    .from("app_user_profiles")
    .select("user_id, athlete_id")
    .in("athlete_id", ids);
  const userIds = [
    ...new Set(((profiles ?? []) as Array<Record<string, unknown>>).map((r) => String(r.user_id ?? "")).filter(Boolean)),
  ];
  if (userIds.length === 0) return out;

  const entitlements = await loadAccessEntitlementsForUserIds(db, userIds);
  for (const entry of entitlements.values()) {
    if (entry.athleteId && entry.entitlement.hasAthleteAccess) out.add(entry.athleteId);
  }
  return out;
}
