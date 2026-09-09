import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { composeDashboardScores } from "@/lib/dashboard/dashboard-scores";
import {
  buildDashboardScoresForAthlete,
  readSnapshotTrends,
  todayIso,
} from "@/lib/dashboard/daily-score-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * GET /api/dashboard/scores?athleteId=...&date=YYYY-MM-DD
 * Punteggi 0–100 delle 9 aree + readiness + stato sistema + KPI fisiologici.
 * Riusa i risolutori canonici (twin / recovery / EPI / pannelli salute) — nessuna fisiologia inventata.
 *
 * SOLA LETTURA: la riga giornaliera su `dashboard_daily_scores` la scrive il cron delle 05:00
 * (`/api/dashboard/scores/snapshot/cron`). Prima la scriveva questa GET a ogni visita, quindi il
 * trend a 30 giorni aveva un punto solo nei giorni in cui qualcuno apriva la pagina.
 */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const generatedAt = (req.nextUrl.searchParams.get("generatedAt") ?? "").trim() || undefined;
    const date = (req.nextUrl.searchParams.get("date") ?? "").trim() || undefined;
    const end = todayIso();

    const { db } = await requireAthleteReadContext(req, athleteId);

    const built = await buildDashboardScoresForAthlete(db, athleteId, { generatedAt, date, endIso: end });
    if (!built.ok) {
      return NextResponse.json({ ok: false as const, error: built.error }, { status: 500, headers: NO_STORE });
    }

    const snapshotTrends = await readSnapshotTrends(createSupabaseAdminClient(), athleteId, end);
    const payload = snapshotTrends
      ? composeDashboardScores({ ...built.baseInput, snapshotTrends })
      : built.today;
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "dashboard_scores_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
