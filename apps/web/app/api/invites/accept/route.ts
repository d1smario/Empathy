import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import { bootstrapAppUserProfile } from "@/lib/auth/bootstrap-app-user-profile";
import { acceptCoachInviteToken } from "@/lib/auth/accept-coach-invite-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { token?: string };

/**
 * Atleta loggato accetta invito: crea riga coach_athletes (coach invitante ↔ athlete_id del profilo utente).
 */
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503 },
    );
  }

  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) {
    return NextResponse.json({ ok: false as const, error: "Supabase non configurato." }, { status: 503 });
  }

  const {
    data: { user },
    error: authErr,
  } = await cookieClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false as const, error: "Non autenticato." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false as const, error: "Token mancante." }, { status: 400 });
  }

  const { data: profile, error: profErr } = await cookieClient
    .from("app_user_profiles")
    .select("role, athlete_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ ok: false as const, error: profErr.message }, { status: 500 });
  }

  const prof = profile as { role?: string; athlete_id?: string | null } | null;
  if (prof?.role === "coach") {
    return NextResponse.json(
      { ok: false as const, error: "Gli account coach non possono accettare questo invito atleta." },
      { status: 403 },
    );
  }

  let athleteId = prof?.athlete_id?.trim() || null;
  if (!athleteId) {
    // Hardening: il registrante può non avere ancora un profilo atleta collegato
    // (es. primo accesso post-invito). Lo creiamo al volo come faremmo da ensure-profile
    // invece di bloccare con 400, così l'auto-accept va a buon fine.
    const { error: bootstrapErr } = await bootstrapAppUserProfile(cookieClient, {
      userId: user.id,
      role: "private",
      email: user.email ?? null,
    });
    if (bootstrapErr) {
      return NextResponse.json({ ok: false as const, error: bootstrapErr }, { status: 500 });
    }

    const { data: refreshed, error: refreshErr } = await cookieClient
      .from("app_user_profiles")
      .select("athlete_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (refreshErr) {
      return NextResponse.json({ ok: false as const, error: refreshErr.message }, { status: 500 });
    }
    athleteId = (refreshed as { athlete_id?: string | null } | null)?.athlete_id?.trim() || null;
  }

  if (!athleteId) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Impossibile creare o risolvere il profilo atleta collegato al tuo account.",
      },
      { status: 500 },
    );
  }

  // Collegamento ESCLUSIVO + consumo token via punto server-side condiviso
  // (stesso codice usato da ensure-profile e /auth/callback per l'auto-collegamento).
  const result = await acceptCoachInviteToken(admin, { token, userId: user.id, athleteId });
  if (!result.ok) {
    const status = result.error === "Invito già utilizzato."
      ? 409
      : result.error === "Invito scaduto."
        ? 410
        : result.error === "Invito non trovato."
          ? 404
          : 500;
    return NextResponse.json({ ok: false as const, error: result.error ?? "Errore invito." }, { status });
  }

  return NextResponse.json({
    ok: true as const,
    orgId: result.orgId,
    coachUserId: result.coachUserId,
    athleteId,
  });
}
