import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  planSummaryFromDetails,
  publishDbWorkoutsToCalendar,
  readDbEngineWorkouts,
} from "@/lib/training/db-engine/publish-db-workouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Bridge piano motore Postgres → calendario.
 * - `phases` presente → RPC `public.generate_training_plan_custom(p_athlete_id, p_start, p_phases,
 *   p_discipline, p_family, p_chips, p_goal_text)` (phases: array `{phase, weeks, weeklyTss?, sessions?}`,
 *   fasi ammesse: base/build/refine/peak/deload/second_peak).
 * - altrimenti → RPC `public.generate_training_plan(p_athlete_id, p_start, p_end, p_discipline)` (`end` obbligatorio).
 * Poi lettura workout `where plan_id`, pubblicazione canonica su `planned_workouts` e riepilogo
 * settimane da `training_plan_week`.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseIsoDate(v: unknown): string | null {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseChips(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 24);
}

const PLAN_PHASES = ["base", "build", "refine", "peak", "deload", "second_peak"] as const;

type PlanPhaseInput = { phase: string; weeks: number; weeklyTss?: number; sessions?: number };

function parsePhases(v: unknown): { phases: PlanPhaseInput[] } | { error: string } | null {
  if (v == null) return null;
  if (!Array.isArray(v) || v.length === 0) {
    return { error: "phases deve essere un array non vuoto di {phase, weeks, weeklyTss?, sessions?}" };
  }
  const phases: PlanPhaseInput[] = [];
  for (const raw of v) {
    if (!isRecord(raw)) return { error: "phases: ogni elemento deve essere un oggetto {phase, weeks, …}" };
    const phase = String(raw.phase ?? "").trim();
    if (!(PLAN_PHASES as readonly string[]).includes(phase)) {
      return { error: `phases: fase non valida "${phase}" (ammesse: ${PLAN_PHASES.join(", ")})` };
    }
    const weeksRaw = Number(raw.weeks ?? 1);
    const entry: PlanPhaseInput = {
      phase,
      weeks: Math.max(1, Math.min(26, Math.round(Number.isFinite(weeksRaw) ? weeksRaw : 1))),
    };
    const weeklyTss = Number(raw.weeklyTss);
    if (raw.weeklyTss != null && Number.isFinite(weeklyTss) && weeklyTss > 0) {
      entry.weeklyTss = Math.round(weeklyTss);
    }
    const sessions = Number(raw.sessions);
    if (raw.sessions != null && Number.isFinite(sessions) && sessions > 0) {
      entry.sessions = Math.round(sessions);
    }
    phases.push(entry);
  }
  return { phases };
}

type PlanWeekSummary = {
  weekStart: string;
  phase: string;
  weekInPhase: number;
  budgetTss: number;
  sessions: number;
  workoutCount: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!isRecord(body)) {
      return NextResponse.json({ ok: false as const, error: "invalid_json_body" }, { status: 400, headers: NO_STORE });
    }

    const athleteId = String(body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const start = parseIsoDate(body.start);
    if (!start) {
      return NextResponse.json(
        { ok: false as const, error: "missing_or_invalid_start (YYYY-MM-DD)" },
        { status: 400, headers: NO_STORE },
      );
    }

    const parsedPhases = parsePhases(body.phases);
    if (parsedPhases && "error" in parsedPhases) {
      return NextResponse.json({ ok: false as const, error: parsedPhases.error }, { status: 400, headers: NO_STORE });
    }
    const end = parseIsoDate(body.end);
    if (!parsedPhases && !end) {
      return NextResponse.json(
        { ok: false as const, error: "serve end (YYYY-MM-DD) oppure phases[]" },
        { status: 400, headers: NO_STORE },
      );
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        { ok: false as const, error: "Motore DB non disponibile: SUPABASE_SERVICE_ROLE_KEY mancante" },
        { status: 500, headers: NO_STORE },
      );
    }

    /** Default disciplina DB-side: 'ciclismo' (piano) — esplicitiamo per coerenza con generate-week. */
    const discipline = String(body.discipline ?? "").trim() || "ciclismo";

    let planId: string | null = null;
    if (parsedPhases) {
      const { data, error } = await admin.rpc("generate_training_plan_custom", {
        p_athlete_id: athleteId,
        p_start: start,
        p_phases: parsedPhases.phases,
        p_discipline: discipline,
        p_family: String(body.family ?? "aerobic").trim() || "aerobic",
        p_chips: parseChips(body.chips),
        p_goal_text: String(body.goalText ?? "").trim(),
      });
      if (error || !data) {
        return NextResponse.json(
          { ok: false as const, error: `generate_training_plan_custom fallita: ${error?.message ?? "nessun plan id"}` },
          { status: 500, headers: NO_STORE },
        );
      }
      planId = String(data);
    } else {
      const { data, error } = await admin.rpc("generate_training_plan", {
        p_athlete_id: athleteId,
        p_start: start,
        p_end: end,
        p_discipline: discipline,
      });
      if (error || !data) {
        return NextResponse.json(
          { ok: false as const, error: `generate_training_plan fallita: ${error?.message ?? "nessun plan id"}` },
          { status: 500, headers: NO_STORE },
        );
      }
      planId = String(data);
    }

    const { data: planWorkoutRows, error: planWorkoutsErr } = await admin
      .from("workout")
      .select("id")
      .eq("plan_id", planId)
      .order("date", { ascending: true });
    if (planWorkoutsErr) {
      return NextResponse.json(
        { ok: false as const, error: `Lettura workout piano fallita: ${planWorkoutsErr.message}` },
        { status: 500, headers: NO_STORE },
      );
    }
    const workoutIds = (planWorkoutRows ?? [])
      .map((r) => String((r as { id?: unknown }).id ?? "").trim())
      .filter(Boolean);

    const details = await readDbEngineWorkouts(admin, workoutIds);

    const publish = body.publish !== false;
    let published = 0;
    let skippedDedupe = 0;
    let builderContracts = 0;
    if (publish) {
      const result = await publishDbWorkoutsToCalendar(db, details);
      published = result.insertedCount;
      skippedDedupe = result.dedupeSkippedCount;
      builderContracts = result.builderContractCount;
    }

    const { data: weekRows, error: weeksErr } = await admin
      .from("training_plan_week")
      .select("week_start,phase,week_in_phase,budget_tss,sessions,workout_count")
      .eq("plan_id", planId)
      .order("week_start", { ascending: true });
    if (weeksErr) {
      return NextResponse.json(
        { ok: false as const, error: `Lettura training_plan_week fallita: ${weeksErr.message}` },
        { status: 500, headers: NO_STORE },
      );
    }
    const weeks: PlanWeekSummary[] = (weekRows ?? []).map((raw) => {
      const w = raw as Record<string, unknown>;
      return {
        weekStart: String(w.week_start ?? "").slice(0, 10),
        phase: String(w.phase ?? ""),
        weekInPhase: Math.round(Number(w.week_in_phase ?? 0) || 0),
        budgetTss: Math.round(Number(w.budget_tss ?? 0) || 0),
        sessions: Math.round(Number(w.sessions ?? 0) || 0),
        workoutCount: Math.round(Number(w.workout_count ?? 0) || 0),
      };
    });

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        planId,
        workoutIds,
        published,
        skippedDedupe,
        builderContracts,
        weeks,
        planSummary: planSummaryFromDetails(details),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "generate-plan failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
