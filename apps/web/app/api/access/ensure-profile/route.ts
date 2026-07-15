import { NextResponse } from "next/server";
import { bootstrapAppUserProfile } from "@/lib/auth/bootstrap-app-user-profile";
import { linkAthleteByCoachCode } from "@/lib/auth/link-coach-by-code";
import { acceptCoachInviteToken } from "@/lib/auth/accept-coach-invite-token";
import { resolveBootstrapRole } from "@/lib/auth/resolve-bootstrap-role";
import { coachOperationalApproved } from "@/lib/platform-coach-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Bootstrap profilo app + collegamento atleta (stesso contratto logico di V1).
 * Auth: cookie SSR (niente Bearer). Richiede RLS coerenti sullo stesso progetto Supabase di V1.
 */
export async function POST(req: Request) {
  const supabase = createSupabaseCookieClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    userId?: string;
    role?: "private" | "coach";
    athleteId?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    coachCode?: string | null;
    inviteToken?: string | null;
  };
  const userId = (body.userId ?? "").trim();
  const requestedRole = body.role ?? "private";
  if (!userId || userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const explicitAthleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const athleteIdBody = explicitAthleteId || null;
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const firstName = String(body.firstName ?? "").trim() || null;
  const lastName = String(body.lastName ?? "").trim() || null;

  const { data: existing, error: existingErr } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id, platform_coach_status, is_platform_admin")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  const current = existing as {
    role: "private" | "coach";
    athlete_id: string | null;
    platform_coach_status?: string | null;
    is_platform_admin?: boolean | null;
  } | null;

  // Platform admin: nessun bootstrap atleta — l'account admin non è un atleta.
  if (current?.is_platform_admin === true) {
    return NextResponse.json({
      status: "admin",
      role: current.role === "coach" ? "coach" : "private",
      requestedRole,
      roleLockedFromDowngrade: false,
      athleteId: null,
      platformCoachStatus: current.platform_coach_status ?? null,
    });
  }

  const role = resolveBootstrapRole(requestedRole, current);

  const athleteIdForBootstrap =
    role === "coach" ? athleteIdBody : athleteIdBody ?? current?.athlete_id ?? null;

  const result = await bootstrapAppUserProfile(supabase, {
    userId,
    role,
    email,
    firstName,
    lastName,
    athleteId: athleteIdForBootstrap,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { data: after } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id, platform_coach_status")
    .eq("user_id", userId)
    .maybeSingle();
  const rowAfter = after as {
    role?: "private" | "coach";
    athlete_id?: string | null;
    platform_coach_status?: string | null;
  } | null;
  const effectiveRole = rowAfter?.role === "coach" ? "coach" : "private";
  const resolvedAthleteId = effectiveRole === "private" ? (rowAfter?.athlete_id ?? null) : null;
  const platformCoachStatus = rowAfter?.platform_coach_status ?? null;

  // Codice coach (opzionale) inserito a registrazione: collegamento ESCLUSIVO via RPC.
  // Solo per atleti con athlete_id già pronto; un fallimento non blocca il signup.
  // Fallback: se il caller non passa coachCode (es. retry shell dopo conferma email),
  // lo recuperiamo da user_metadata.coach_code, dove viene persistito a signup → così
  // il collegamento è recuperabile anche se il primo tentativo nel callback è fallito.
  const meta = user.user_metadata as Record<string, unknown>;
  const metaCoachCodeRaw = meta?.coach_code;
  const metaCoachCode = typeof metaCoachCodeRaw === "string" ? metaCoachCodeRaw : null;
  const bodyCoachCode = typeof body.coachCode === "string" && body.coachCode.trim() ? body.coachCode : null;
  const effectiveCoachCode = bodyCoachCode ?? metaCoachCode;

  // Token invito coach (dal link `/invite/<token>`): ha la precedenza sul codice.
  // Fallback da user_metadata.invite_token come per il codice, così è recuperabile.
  const metaInviteTokenRaw = meta?.invite_token;
  const metaInviteToken = typeof metaInviteTokenRaw === "string" ? metaInviteTokenRaw : null;
  const bodyInviteToken = typeof body.inviteToken === "string" && body.inviteToken.trim() ? body.inviteToken : null;
  const effectiveInviteToken = bodyInviteToken ?? metaInviteToken;

  let coachLinked = false;
  if (effectiveRole === "private" && resolvedAthleteId && effectiveInviteToken) {
    // Collegamento via TOKEN (auto da link): richiede client service-role.
    const admin = createSupabaseAdminClient();
    if (admin) {
      const accepted = await acceptCoachInviteToken(admin, {
        token: effectiveInviteToken,
        userId,
        athleteId: resolvedAthleteId,
      });
      coachLinked = accepted.ok;
    }
  } else if (effectiveRole === "private" && resolvedAthleteId && effectiveCoachCode) {
    const link = await linkAthleteByCoachCode(supabase, effectiveCoachCode);
    coachLinked = link.ok;
  }

  return NextResponse.json({
    status: current ? "existing" : "created",
    role: effectiveRole,
    requestedRole,
    roleLockedFromDowngrade: requestedRole === "private" && effectiveRole === "coach",
    athleteId: resolvedAthleteId,
    platformCoachStatus,
    coachOperationalApproved: coachOperationalApproved(effectiveRole, platformCoachStatus),
    coachLinked,
  });
}
