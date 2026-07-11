import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadEntitledAthleteIds } from "@/lib/onboarding/onboarding-window";
import { runWeeklyReplan } from "@/lib/nutrition/weekly-replan-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return !!secret && (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}
function isoDateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function mondayOfUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0=dom
  x.setUTCDate(x.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

/**
 * Cron settimanale (schedulata MARTEDÌ): ripianifica la settimana PROSSIMA della nutrizione
 * per gli atleti con piano attivo + diritto d'uso, imparando dagli ultimi 7 giorni (Decisione B).
 * Non tocca mai la settimana in corso. Dry-run di default: `?run=true` genera.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const run = sp.get("run") === "true";
  const onlyAthlete = sp.get("athleteId")?.trim() || null; // override per verifica/ops
  const weekStartOverride = sp.get("weekStart")?.trim() || null;
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "Service role non configurato" }, { status: 500 });
  }

  const now = new Date();
  const referenceDate = isoDateUTC(now);
  const nextMonday = new Date(mondayOfUTC(now).getTime());
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7); // settimana successiva, mai la corrente
  const weekStart = weekStartOverride && /^\d{4}-\d{2}-\d{2}$/.test(weekStartOverride) ? weekStartOverride : isoDateUTC(nextMonday);

  // Atleti con piano nutrizione attivo di recente (o singolo atleta se override).
  let candidateIds: string[];
  if (onlyAthlete) {
    candidateIds = [onlyAthlete];
  } else {
    const sinceIso = isoDateUTC(new Date(now.getTime() - 21 * 86_400_000));
    const { data: planRows, error } = await db.from("nutrition_plan").select("athlete_id").gte("plan_date", sinceIso);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    candidateIds = [...new Set(((planRows ?? []) as Array<Record<string, unknown>>).map((r) => String(r.athlete_id ?? "")).filter(Boolean))];
  }
  const entitled = await loadEntitledAthleteIds(db, candidateIds);
  const targets = candidateIds.filter((id) => entitled.has(id));

  const summary = { weekStart, referenceDate, candidates: candidateIds.length, entitled: targets.length, replanned: 0, errors: 0 };
  if (!run) {
    return NextResponse.json({ ok: true, dryRun: true, summary, preview: targets.slice(0, 50) });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const athleteId of targets) {
    try {
      const r = await runWeeklyReplan(db, athleteId, weekStart, referenceDate);
      if (r.ok) summary.replanned++;
      else summary.errors++;
      results.push({ athleteId, ok: r.ok, factor: r.correction.factor, daysUsed: r.correction.daysUsed, days: r.days.filter((d) => d.ok).length });
    } catch (e) {
      summary.errors++;
      results.push({ athleteId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ ok: true, dryRun: false, summary, results });
}
