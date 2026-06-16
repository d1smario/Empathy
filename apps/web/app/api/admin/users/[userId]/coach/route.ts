import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { coachUserId?: string };

/**
 * POST /api/admin/users/[userId]/coach
 * Service role: assegna (ESCLUSIVO) il coach a un utente.
 * Un atleta ha UN solo coach → si rimuove il legame precedente e si inserisce il nuovo.
 * Validazioni clonate da `POST /api/invites/accept`: il coach deve avere
 * role='coach' AND platform_coach_status='approved'; il target non può essere coach.
 */
export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY per aggiornamento admin." },
      { status: 503 },
    );
  }

  const userId = (params.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "userId mancante." }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "Body JSON non valido." }, { status: 400 });
  }
  const coachUserId = typeof body.coachUserId === "string" ? body.coachUserId.trim() : "";
  if (!coachUserId) {
    return NextResponse.json({ ok: false as const, error: "coachUserId mancante." }, { status: 400 });
  }

  // Risolvi athlete_id del target dal profilo app.
  const { data: targetProfile, error: targetErr } = await admin
    .from("app_user_profiles")
    .select("role, athlete_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetErr) {
    return NextResponse.json({ ok: false as const, error: targetErr.message }, { status: 500 });
  }
  const target = targetProfile as { role?: string | null; athlete_id?: string | null } | null;

  if (target?.role === "coach") {
    return NextResponse.json(
      { ok: false as const, error: "L'utente di destinazione è un coach: non può avere un coach assegnato." },
      { status: 409 },
    );
  }

  const athleteId = target?.athlete_id?.trim() || null;
  if (!athleteId) {
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "Nessun atleta collegato al profilo. L'utente deve aver completato almeno un accesso (ensure-profile) prima dell'assegnazione coach.",
      },
      { status: 400 },
    );
  }

  // Valida che il coach target sia un coach approvato.
  const { data: coachProfile, error: coachErr } = await admin
    .from("app_user_profiles")
    .select("role, platform_coach_status")
    .eq("user_id", coachUserId)
    .maybeSingle();

  if (coachErr) {
    return NextResponse.json({ ok: false as const, error: coachErr.message }, { status: 500 });
  }
  const coach = coachProfile as { role?: string | null; platform_coach_status?: string | null } | null;
  if (!coach) {
    return NextResponse.json({ ok: false as const, error: "Coach non trovato." }, { status: 404 });
  }
  if (coach.role !== "coach" || coach.platform_coach_status !== "approved") {
    return NextResponse.json(
      { ok: false as const, error: "Il coach selezionato non è un coach approvato della piattaforma." },
      { status: 409 },
    );
  }

  const orgId = coachOrgIdForDb();

  // ESCLUSIVO: rimuovi qualunque legame esistente per questo atleta, poi inserisci il nuovo.
  const { error: delErr } = await admin.from("coach_athletes").delete().eq("athlete_id", athleteId);
  if (delErr) {
    return NextResponse.json({ ok: false as const, error: delErr.message }, { status: 500 });
  }

  const { error: insErr } = await admin.from("coach_athletes").upsert(
    {
      org_id: orgId,
      coach_user_id: coachUserId,
      athlete_id: athleteId,
    },
    { onConflict: "org_id,coach_user_id,athlete_id", ignoreDuplicates: true },
  );
  if (insErr) {
    return NextResponse.json({ ok: false as const, error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    userId,
    athleteId,
    coachUserId,
    orgId,
  });
}

/**
 * DELETE /api/admin/users/[userId]/coach
 * Service role: scollega il coach dell'utente (rimuove la riga per quell'atleta).
 */
export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY per aggiornamento admin." },
      { status: 503 },
    );
  }

  const userId = (params.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "userId mancante." }, { status: 400 });
  }

  const { data: targetProfile, error: targetErr } = await admin
    .from("app_user_profiles")
    .select("athlete_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetErr) {
    return NextResponse.json({ ok: false as const, error: targetErr.message }, { status: 500 });
  }
  const athleteId = (targetProfile as { athlete_id?: string | null } | null)?.athlete_id?.trim() || null;
  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "Nessun atleta collegato al profilo: niente coach da scollegare." },
      { status: 400 },
    );
  }

  const { error: delErr } = await admin.from("coach_athletes").delete().eq("athlete_id", athleteId);
  if (delErr) {
    return NextResponse.json({ ok: false as const, error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, userId, athleteId });
}
