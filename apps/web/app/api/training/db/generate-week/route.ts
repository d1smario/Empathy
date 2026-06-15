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
 * Bridge settimana motore Postgres → calendario.
 * RPC `public.generate_training_week` (overload 9 parametri — passare **tutti** i nominati per
 * disambiguare dall'overload a 6) → lettura workout/blocchi/esercizi → pubblicazione canonica
 * su `planned_workouts` (`insertPlannedWorkoutRows`: dedupe fingerprint + clamp, no insert diretto).
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
    const weekStart = parseIsoDate(body.weekStart);
    if (!weekStart) {
      return NextResponse.json(
        { ok: false as const, error: "missing_or_invalid_weekStart (YYYY-MM-DD)" },
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

    const sessionsRaw = Number(body.sessions ?? 5);
    const weeklyTssRaw = Number(body.weeklyTss ?? 460);
    const rpcArgs = {
      p_athlete_id: athleteId,
      p_week_start: weekStart,
      p_discipline: String(body.discipline ?? "cycling").trim() || "cycling",
      p_sessions: Math.max(1, Math.min(14, Math.round(Number.isFinite(sessionsRaw) ? sessionsRaw : 5))),
      p_weekly_tss: Math.max(50, Math.min(2000, Math.round(Number.isFinite(weeklyTssRaw) ? weeklyTssRaw : 460))),
      p_phase: String(body.phase ?? "base").trim() || "base",
      p_family: String(body.family ?? "aerobic").trim() || "aerobic",
      p_chips: parseChips(body.chips),
      p_goal_text: String(body.goalText ?? "").trim(),
    };

    const { data: rpcData, error: rpcErr } = await admin.rpc("generate_training_week", rpcArgs);
    if (rpcErr) {
      return NextResponse.json(
        { ok: false as const, error: `generate_training_week fallita: ${rpcErr.message}` },
        { status: 500, headers: NO_STORE },
      );
    }
    const workoutIds = (Array.isArray(rpcData) ? rpcData : rpcData != null ? [rpcData] : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (workoutIds.length === 0) {
      return NextResponse.json(
        { ok: false as const, error: "generate_training_week: nessun workout generato" },
        { status: 500, headers: NO_STORE },
      );
    }

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

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        weekStart,
        workoutIds,
        published,
        skippedDedupe,
        builderContracts,
        planSummary: planSummaryFromDetails(details),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "generate-week failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
