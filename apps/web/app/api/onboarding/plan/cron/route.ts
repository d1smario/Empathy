import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadOnboardingCompleteness } from "@/lib/onboarding/load-onboarding-snapshot";
import { buildMacroPhases } from "@/lib/training/build-macro-phases";
import { generateAndPublishTrainingMacro } from "@/lib/training/generate-training-macro";
import { generateAndPersistMealPlanV2 } from "@/lib/nutrition/generate-meal-plan-v2-headless";
import { loadEntitledAthleteIds, resolvePlanWindowStartIso } from "@/lib/onboarding/onboarding-window";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Il piano si genera al 3° giorno (proxy: created_at + 3gg = D4 start). */
const D3_MIN_DAYS = 2; // daysSince: 0=D1, 1=D2, 2=D3 → genera da D3 in poi
const WINDOW_LOOKBACK_DAYS = 8;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}
function isoDateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function mondayOfUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0=dom
  x.setUTCDate(x.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

/**
 * Cron trigger di generazione del piano a D3 (Decisione A: Empathy genera in automatico).
 * Per gli atleti nella finestra con onboarding COMPLETO e non ancora generati: crea il
 * TRAINING (RPC settimana → planned_workouts) e la NUTRIZIONE (V2 → nutrition_plan/meal),
 * poi segna onboarding_plan_bootstrap (idempotente). Dry-run di default: `?run=true` genera.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  const run = new URL(req.url).searchParams.get("run") === "true";
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "Service role non configurato" }, { status: 500 });
  }

  const sinceIso = new Date(Date.now() - WINDOW_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await db
    .from("athlete_profiles")
    .select("id, created_at, plan_started_at, training_days_per_week, training_max_session_minutes, goals")
    .or(`created_at.gte.${sinceIso},plan_started_at.gte.${sinceIso}`);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Solo atleti con diritto d'uso (prova/abbonamento/grant) generano il piano.
  const entitled = await loadEntitledAthleteIds(db, ((rows ?? []) as Array<Record<string, unknown>>).map((r) => String(r.id ?? "")));

  const summary = { inWindow: rows?.length ?? 0, eligible: 0, generated: 0, skippedNotEntitled: 0, skippedEarly: 0, skippedDone: 0, skippedNotReady: 0, errors: 0 };
  const preview: Array<{ athleteId: string; planStart: string; weekStart: string }> = [];
  const results: Array<{ athleteId: string; trainingOk: boolean; nutritionOk: boolean; error?: string }> = [];

  for (const raw of (rows ?? []) as Array<Record<string, unknown>>) {
    const athleteId = String(raw.id ?? "");
    const windowStart = resolvePlanWindowStartIso(raw);
    if (!athleteId || !windowStart) continue;
    if (!entitled.has(athleteId)) {
      summary.skippedNotEntitled++;
      continue;
    }

    const daysSince = Math.floor((Date.now() - new Date(windowStart).getTime()) / 86_400_000);
    if (daysSince < D3_MIN_DAYS) {
      summary.skippedEarly++;
      continue;
    }

    const { data: already } = await db
      .from("onboarding_plan_bootstrap")
      .select("athlete_id")
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (already?.athlete_id) {
      summary.skippedDone++;
      continue;
    }

    const completeness = await loadOnboardingCompleteness(db, athleteId);
    if (!completeness.planReady) {
      summary.skippedNotReady++;
      continue;
    }
    summary.eligible++;

    const start = new Date(windowStart);
    const planStart = isoDateUTC(addDaysUTC(start, 3)); // D4
    const weekStart = isoDateUTC(mondayOfUTC(addDaysUTC(start, 3)));

    if (!run) {
      preview.push({ athleteId, planStart, weekStart });
      continue;
    }

    let trainingOk = false;
    let nutritionOk = false;
    let errMsg: string | undefined;
    try {
      // Training: MACRO periodizzato (base→build→deload…), non più 1 sola settimana.
      // Open-ended di default (nessuna gara collegata): arco base/build con scarichi.
      const goals = Array.isArray(raw.goals)
        ? (raw.goals as unknown[]).filter((g): g is string => typeof g === "string")
        : [];
      const phases = buildMacroPhases({ startDate: weekStart, goalEventDate: null });
      const tRes = await generateAndPublishTrainingMacro(db, {
        athleteId,
        startDate: weekStart,
        phases,
        discipline: "cycling",
        goalText: goals.join(", "),
      });
      trainingOk = tRes.ok;
      if (!tRes.ok) errMsg = tRes.error;

      const nRes = await generateAndPersistMealPlanV2(db, athleteId, planStart);
      nutritionOk = nRes.ok;
      if (!nRes.ok) errMsg = [errMsg, nRes.error].filter(Boolean).join(" | ");
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }

    await db.from("onboarding_plan_bootstrap").insert({
      athlete_id: athleteId,
      training_ok: trainingOk,
      nutrition_ok: nutritionOk,
      week_start: weekStart,
      plan_start: planStart,
      note: errMsg ?? null,
    });

    if (trainingOk || nutritionOk) summary.generated++;
    if (errMsg) summary.errors++;
    results.push({ athleteId, trainingOk, nutritionOk, error: errMsg });
  }

  return NextResponse.json({ ok: true, dryRun: !run, summary, ...(run ? { results } : { preview }) });
}
