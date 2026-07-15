import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Punto server-side UNICO per il collegamento atleta↔coach via TOKEN di invito
 * (link `/invite/<token>`), speculare a [[link-coach-by-code]] per il codice coach.
 * Riutilizzato da /api/invites/accept, /api/access/ensure-profile e /auth/callback,
 * così il link fa TUTTO in automatico a registrazione (zero codici da digitare).
 */

export type CoachInvitePreviewStatus = "valid" | "expired" | "consumed" | "not_found";

export type CoachInvitePreview = {
  status: CoachInvitePreviewStatus;
  /** Nome visualizzato del coach invitante (per il banner "sei stato invitato da …"). */
  coachName: string | null;
};

type InviteRow = {
  id: string;
  org_id: string;
  inviting_coach_user_id: string;
  expires_at: string;
  consumed_at: string | null;
};

/**
 * Nome visualizzato del coach invitante: `full_name` o `Nome Cognome` da user_metadata,
 * fallback email. Richiede client service-role (`admin.auth.admin.getUserById`).
 */
export async function resolveCoachDisplayName(
  admin: SupabaseClient,
  coachUserId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(coachUserId);
    if (error || !data?.user) return null;
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const first = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
    const last = typeof meta.last_name === "string" ? meta.last_name.trim() : "";
    const full = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    const name = full || [first, last].filter(Boolean).join(" ").trim();
    return name || data.user.email || null;
  } catch {
    return null;
  }
}

/**
 * Anteprima invito (validazione token + nome coach) per pagine server. Non muta nulla:
 * serve solo a mostrare "sei stato invitato da X" e a decidere se offrire l'auto-collegamento.
 */
export async function resolveCoachInvitePreview(
  admin: SupabaseClient,
  rawToken: string,
): Promise<CoachInvitePreview> {
  const token = (rawToken ?? "").trim();
  if (!token) return { status: "not_found", coachName: null };
  const { data, error } = await admin
    .from("coach_invitations")
    .select("inviting_coach_user_id, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return { status: "not_found", coachName: null };
  const row = data as { inviting_coach_user_id: string; expires_at: string; consumed_at: string | null };
  let status: CoachInvitePreviewStatus = "valid";
  if (row.consumed_at) status = "consumed";
  else if (new Date(row.expires_at) <= new Date()) status = "expired";
  const coachName = await resolveCoachDisplayName(admin, row.inviting_coach_user_id);
  return { status, coachName };
}

export type AcceptCoachInviteResult = {
  ok: boolean;
  error: string | null;
  coachUserId: string | null;
  orgId: string | null;
};

/**
 * Collega (ESCLUSIVO: rimuove i legami precedenti) l'atleta al coach invitante e
 * consuma il token. Va invocata DOPO che il bootstrap ha garantito `athleteId`, con
 * client service-role. Un fallimento non è mai fatale per il signup (il chiamante lo
 * ignora e prosegue): il collegamento è comunque recuperabile dal link.
 */
export async function acceptCoachInviteToken(
  admin: SupabaseClient,
  params: { token: string; userId: string; athleteId: string },
): Promise<AcceptCoachInviteResult> {
  const token = (params.token ?? "").trim();
  const athleteId = (params.athleteId ?? "").trim();
  if (!token) return { ok: false, error: "Token mancante.", coachUserId: null, orgId: null };
  if (!athleteId) return { ok: false, error: "Profilo atleta mancante.", coachUserId: null, orgId: null };

  const { data, error } = await admin
    .from("coach_invitations")
    .select("id, org_id, inviting_coach_user_id, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, coachUserId: null, orgId: null };
  if (!data) return { ok: false, error: "Invito non trovato.", coachUserId: null, orgId: null };
  const inv = data as InviteRow;
  if (inv.consumed_at) return { ok: false, error: "Invito già utilizzato.", coachUserId: null, orgId: null };
  if (new Date(inv.expires_at) <= new Date())
    return { ok: false, error: "Invito scaduto.", coachUserId: null, orgId: null };

  const { error: unlinkErr } = await admin.from("coach_athletes").delete().eq("athlete_id", athleteId);
  if (unlinkErr) return { ok: false, error: unlinkErr.message, coachUserId: null, orgId: null };

  const { error: linkErr } = await admin.from("coach_athletes").upsert(
    { org_id: inv.org_id, coach_user_id: inv.inviting_coach_user_id, athlete_id: athleteId },
    { onConflict: "org_id,coach_user_id,athlete_id" },
  );
  if (linkErr) return { ok: false, error: linkErr.message, coachUserId: null, orgId: null };

  const { error: updErr } = await admin
    .from("coach_invitations")
    .update({ consumed_at: new Date().toISOString(), consumed_by_user_id: params.userId })
    .eq("id", inv.id);
  if (updErr) return { ok: false, error: updErr.message, coachUserId: null, orgId: null };

  return { ok: true, error: null, coachUserId: inv.inviting_coach_user_id, orgId: inv.org_id };
}
