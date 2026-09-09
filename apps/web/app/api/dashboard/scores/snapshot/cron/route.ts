import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadEntitledAthleteIds } from "@/lib/onboarding/onboarding-window";
import {
  buildDashboardScoresForAthlete,
  persistDailyScoreSnapshot,
  todayIso,
} from "@/lib/dashboard/daily-score-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** Serializzato a piccoli gruppi: la composizione risolve twin + EPI, non è una query leggera. */
const GROUP_SIZE = 4;

/**
 * GET /api/dashboard/scores/snapshot/cron — scrive l'istantanea di oggi per tutta la platea.
 *
 * Perché esiste: il punto giornaliero di `dashboard_daily_scores` lo scriveva la GET dei
 * punteggi, cioè l'apertura di /analysis. Risultato: il trend a 30 giorni aveva un buco per
 * ogni giorno in cui l'atleta non entrava, e se entrava il coach la riga veniva scritta lo
 * stesso, per l'atleta guardato. Ora il trend si accumula da solo, una volta al giorno.
 *
 * Chi entra: gli atleti collegati a un account CON diritto d'uso (stessa platea del replan
 * settimanale). Un atleta che fallisce non ferma gli altri.
 */
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "admin_client_unavailable" }, { status: 500, headers: NO_STORE });
  }

  const date = todayIso();

  const { data: linkRows, error } = await admin
    .from("app_user_profiles")
    .select("athlete_id")
    .not("athlete_id", "is", null);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }

  const candidateIds = [
    ...new Set(((linkRows ?? []) as Array<Record<string, unknown>>).map((r) => String(r.athlete_id ?? "")).filter(Boolean)),
  ];
  const entitled = await loadEntitledAthleteIds(admin, candidateIds);
  const targets = candidateIds.filter((id) => entitled.has(id));

  let written = 0;
  const failed: string[] = [];

  for (let i = 0; i < targets.length; i += GROUP_SIZE) {
    const group = targets.slice(i, i + GROUP_SIZE);
    const outcomes = await Promise.all(
      group.map(async (athleteId) => {
        try {
          const built = await buildDashboardScoresForAthlete(admin, athleteId, { endIso: date });
          if (!built.ok) return { athleteId, ok: false };
          const ok = await persistDailyScoreSnapshot(admin, athleteId, date, built.today);
          return { athleteId, ok };
        } catch {
          return { athleteId, ok: false };
        }
      }),
    );
    for (const o of outcomes) {
      if (o.ok) written += 1;
      else failed.push(o.athleteId);
    }
  }

  return NextResponse.json(
    { ok: true as const, date, candidates: candidateIds.length, entitled: targets.length, written, failed },
    { headers: NO_STORE },
  );
}
