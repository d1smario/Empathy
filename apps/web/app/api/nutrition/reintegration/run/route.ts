import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runPostWorkoutReintegration } from "@/lib/nutrition/reintegration-run";
import { runDailyReduction } from "@/lib/nutrition/reduction-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Calcola e persiste il reintegro post-allenamento per (atleta, giorno). Trigger reali:
 * l'app (Oggi) all'apertura per l'atleta corrente, oppure un servizio/cron con Bearer CRON_SECRET.
 * Idempotente e reversibile (upsert/clear su nutrition_daily_adjustment).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { athleteId?: unknown; date?: unknown };
    const athleteId = String(body.athleteId ?? "").trim();
    const date = (typeof body.date === "string" ? body.date : "").slice(0, 10) || localToday();
    if (!athleteId) {
      return NextResponse.json({ ok: false, error: "Missing athleteId" }, { status: 400 });
    }

    // Auth: Bearer CRON_SECRET (servizio) oppure sessione atleta sul proprio athleteId.
    const secret = process.env.CRON_SECRET?.trim();
    const isService = !!secret && (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
    if (!isService) {
      await requireAthleteReadContext(req, athleteId);
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Service role non configurato" }, { status: 500 });
    }

    // Aggiustamenti adattivi del giorno: reintegro (extra da surplus) + riduzione (skip).
    const [reintegration, reduction] = await Promise.all([
      runPostWorkoutReintegration(admin, athleteId, date),
      runDailyReduction(admin, athleteId, date),
    ]);
    return NextResponse.json({ date, ok: reintegration.ok && reduction.ok, reintegration, reduction });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore" },
      { status: 500 },
    );
  }
}
