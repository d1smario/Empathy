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

  /**
   * `athleteId` ed `email` NON si prendono più dal corpo della richiesta.
   *
   * Erano due chiavi in mano al chiamante: il bootstrap scrive con service_role, quindi
   * chi passava l'athleteId di un altro (o la sua email, risolta per email dal lookup)
   * si collegava alla riga profilo di quell'atleta — e `canAccessAthleteData` concede
   * l'accesso sul solo confronto `athlete_id === target`, prima di guardare ruolo o
   * roster. Nessuno verificava che quei due valori appartenessero a chi chiamava.
   *
   * L'identità ora viene solo dalla sessione: `user.email` è l'unico dato d'identità
   * che il chiamante non può falsificare, e l'athlete_id già collegato si legge dal DB.
   * Il campo `athleteId` resta accettato nel contratto HTTP ma viene ignorato: i client
   * vecchi continuano a funzionare senza poter più decidere a chi collegarsi.
   */
  const email = (user.email ?? "").trim().toLowerCase() || null;
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

  // Solo il collegamento già presente in DB: mai un id che arriva da fuori. Per il coach
  // resta null — il ramo coach del bootstrap userebbe quell'id per iscriversi in
  // `coach_athletes` come coach dell'atleta indicato, e quell'iscrizione non deve poter
  // nascere da una richiesta del client.
  const athleteIdForBootstrap = role === "coach" ? null : (current?.athlete_id ?? null);

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
