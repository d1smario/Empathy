import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { ensureFreshGarminAccessTokenForAthlete } from "@/lib/integrations/garmin-access-token";
import { deleteGarminUserRegistration } from "@/lib/integrations/garmin-oauth2-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * DELETE /api/admin/users/[userId]/garmin
 * Platform admin: scollega Garmin per l'atleta dell'utente target.
 * - Risolve `athlete_id` da `app_user_profiles` (userId → athleteId, disaccoppiati).
 * - Deregistra best-effort lato Garmin (`DELETE …/user/registration`) col token salvato.
 * - Rimuove la riga `garmin_athlete_links`. I workout storici restano.
 * Stesso comportamento del disconnect atleta ma con guard admin (nessuna sessione atleta richiesta),
 * così un admin può ripulire un collegamento pasticciato senza impersonare l'utente.
 */
export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY per l'operazione admin." },
      { status: 503, headers: NO_STORE },
    );
  }

  const userId = (params.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "userId mancante." }, { status: 400, headers: NO_STORE });
  }

  const { data: prof, error: profErr } = await admin
    .from("app_user_profiles")
    .select("athlete_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profErr) {
    return NextResponse.json({ ok: false as const, error: profErr.message }, { status: 500, headers: NO_STORE });
  }
  const athleteId =
    typeof (prof as { athlete_id?: unknown } | null)?.athlete_id === "string"
      ? String((prof as { athlete_id: string }).athlete_id).trim()
      : "";
  if (!athleteId) {
    return NextResponse.json({ ok: true as const, disconnected: false, reason: "no_athlete" }, { headers: NO_STORE });
  }

  const { data: row, error: selErr } = await admin
    .from("garmin_athlete_links")
    .select("athlete_id, garmin_user_id, oauth_access_token")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ ok: false as const, error: selErr.message }, { status: 500, headers: NO_STORE });
  }
  if (!row) {
    return NextResponse.json({ ok: true as const, disconnected: false }, { headers: NO_STORE });
  }

  let garminPartnerDeregistered = false;
  const fresh = await ensureFreshGarminAccessTokenForAthlete(admin, athleteId);
  const access =
    "accessToken" in fresh
      ? fresh.accessToken
      : typeof (row as { oauth_access_token?: unknown }).oauth_access_token === "string"
        ? String((row as { oauth_access_token: string }).oauth_access_token).trim()
        : "";
  if (access) {
    try {
      const del = await deleteGarminUserRegistration(access);
      garminPartnerDeregistered = del.ok;
    } catch {
      garminPartnerDeregistered = false;
    }
  }

  const { error: delErr } = await admin.from("garmin_athlete_links").delete().eq("athlete_id", athleteId);
  if (delErr) {
    return NextResponse.json({ ok: false as const, error: delErr.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    {
      ok: true as const,
      disconnected: true,
      garminPartnerDeregistered,
      garminUserId: (row as { garmin_user_id?: string | null }).garmin_user_id ?? null,
    },
    { headers: NO_STORE },
  );
}
