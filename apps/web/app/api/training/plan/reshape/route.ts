import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAuthenticatedTrainingUser,
} from "@/lib/auth/athlete-read-context";
import { assertPlatformEntitlementForApi } from "@/lib/billing/assert-platform-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { materializeTrainingMacro } from "@/lib/training/materialize-training-macro";
import type { PlanPhase } from "@/lib/training/plan/plan-skeleton-types";
import {
  rebuildPlanTimeline,
  type ReshapeMesocycle,
  type ReshapeWeek,
} from "@/lib/training/plan/reshape-plan-timeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** CHECK DB `training_plan_mesocycle.weeks between 1 and 16`: stessa soglia qui. */
const MIN_WEEKS = 1;
const MAX_WEEKS = 16;

/**
 * RIDIMENSIONAMENTO dei mesocicli (leva «lunghezza dei periodi» della spec coach:
 * sistema automatico, il coach regola durate/volume/intensità).
 *
 * Perché un endpoint e non UPDATE diretto browser→Supabase come gli altri edit di
 * settimana: cambiare la durata di una fase fa NASCERE e MORIRE righe
 * `training_plan_week`, e il coach ha solo la policy UPDATE (INSERT/DELETE sono
 * service-role by design). Il gate è identico a /approve: RLS come scope + cintura
 * ruolo, service-role solo dopo.
 *
 * Sul piano già approvato la modifica si propaga anche al calendario: dopo il
 * ricalcolo si ri-materializza la runway (purge+regenerate delle settimane future
 * del piano), così scheletro e sedute non divergono mai.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { planId?: unknown; mesocycles?: unknown }
      | null;
    const planId = typeof body?.planId === "string" ? body.planId.trim() : "";
    if (!planId) {
      return NextResponse.json({ ok: false as const, error: "missing_planId" }, { status: 400, headers: NO_STORE });
    }
    const requested = Array.isArray(body?.mesocycles) ? body!.mesocycles : null;
    if (!requested || requested.length === 0) {
      return NextResponse.json({ ok: false as const, error: "missing_mesocycles" }, { status: 400, headers: NO_STORE });
    }
    const wanted = new Map<string, number>();
    for (const raw of requested) {
      const row = raw as { id?: unknown; weeks?: unknown };
      const id = typeof row?.id === "string" ? row.id.trim() : "";
      const weeks = Number(row?.weeks);
      if (!id || !Number.isFinite(weeks) || weeks < MIN_WEEKS || weeks > MAX_WEEKS) {
        return NextResponse.json(
          { ok: false as const, error: "invalid_weeks" },
          { status: 400, headers: NO_STORE },
        );
      }
      wanted.set(id, Math.round(weeks));
    }

    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    await assertPlatformEntitlementForApi(userId, rlsClient);

    // 1) Scope via RLS (stessa logica di /approve: fuori scope → la riga non esiste).
    const { data: planRow, error: planErr } = await rlsClient
      .from("training_plan")
      .select("id, athlete_id, status, start_date")
      .eq("id", planId)
      .maybeSingle();
    if (planErr) {
      return NextResponse.json({ ok: false as const, error: planErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!planRow) {
      return NextResponse.json({ ok: false as const, error: "plan_not_found" }, { status: 404, headers: NO_STORE });
    }
    const plan = planRow as { id: string; athlete_id: string; status: string | null; start_date: string | null };
    if (plan.status === "archived") {
      return NextResponse.json({ ok: false as const, error: "plan_archived" }, { status: 409, headers: NO_STORE });
    }

    // 2) Cintura ruolo: solo coach in scope o platform admin.
    const { data: callerRow } = await rlsClient
      .from("app_user_profiles")
      .select("role, is_platform_admin")
      .eq("user_id", userId)
      .maybeSingle();
    const caller = callerRow as { role?: string | null; is_platform_admin?: boolean | null } | null;
    if (caller?.role !== "coach" && caller?.is_platform_admin !== true) {
      return NextResponse.json({ ok: false as const, error: "forbidden" }, { status: 403, headers: NO_STORE });
    }

    // 3) Service-role SOLO dopo il gate.
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false as const, error: "service_role_required" }, { status: 503, headers: NO_STORE });
    }

    const [{ data: mesoRows, error: mesoErr }, { data: weekRows, error: weekErr }] = await Promise.all([
      admin
        .from("training_plan_mesocycle")
        .select("id, seq, phase, weeks, weekly_tss_target, sessions_target")
        .eq("plan_id", planId)
        .order("seq", { ascending: true }),
      admin
        .from("training_plan_week")
        .select("id, week_start, week_in_phase, budget_tss, sessions, hours_target, objectives, coach_notes, family_mix, mesocycle_id")
        .eq("plan_id", planId),
    ]);
    if (mesoErr || weekErr) {
      return NextResponse.json(
        { ok: false as const, error: mesoErr?.message ?? weekErr?.message ?? "load_failed" },
        { status: 500, headers: NO_STORE },
      );
    }

    type MesoDb = {
      id: string;
      seq: number;
      phase: string;
      weeks: number;
      weekly_tss_target: number | null;
      sessions_target: number | null;
    };
    const mesosDb = (mesoRows ?? []) as MesoDb[];
    if (mesosDb.length === 0) {
      return NextResponse.json({ ok: false as const, error: "no_mesocycles" }, { status: 409, headers: NO_STORE });
    }
    // Ogni id richiesto deve appartenere a QUESTO piano (niente scritture cross-plan).
    for (const id of wanted.keys()) {
      if (!mesosDb.some((m) => m.id === id)) {
        return NextResponse.json({ ok: false as const, error: "mesocycle_not_in_plan" }, { status: 400, headers: NO_STORE });
      }
    }

    const changed = mesosDb.filter((m) => wanted.has(m.id) && wanted.get(m.id) !== m.weeks);
    if (changed.length === 0) {
      return NextResponse.json({ ok: true as const, planId, changed: 0, noop: true }, { headers: NO_STORE });
    }
    const fromSeq = Math.min(...changed.map((m) => m.seq));

    const seqById = new Map(mesosDb.map((m) => [m.id, m.seq]));
    const mesocycles: ReshapeMesocycle[] = mesosDb.map((m) => ({
      id: m.id,
      seq: m.seq,
      phase: m.phase as PlanPhase,
      weeks: wanted.get(m.id) ?? m.weeks,
      weeklyTssTarget: m.weekly_tss_target,
      sessionsTarget: m.sessions_target,
    }));
    const weeks: ReshapeWeek[] = (weekRows ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      const mesoId = typeof r.mesocycle_id === "string" ? r.mesocycle_id : null;
      return {
        id: String(r.id),
        weekStart: String(r.week_start).slice(0, 10),
        mesocycleSeq: mesoId ? (seqById.get(mesoId) ?? null) : null,
        weekInPhase: Number(r.week_in_phase) || 1,
        budgetTss: Number(r.budget_tss) || 0,
        sessions: Number(r.sessions) || 0,
        hoursTarget: r.hours_target == null ? null : Number(r.hours_target),
        objectives: r.objectives ?? {},
        coachNotes: typeof r.coach_notes === "string" ? r.coach_notes : null,
        familyMix: r.family_mix ?? { aerobic_pct: 100, gym_pct: 0 },
      };
    });

    const rebuilt = rebuildPlanTimeline({
      mesocycles,
      weeks,
      fromSeq,
      todayIso: new Date().toISOString().slice(0, 10),
    });
    if (!rebuilt.ok) {
      const status = rebuilt.error === "mesocycle_already_started" ? 409 : 400;
      return NextResponse.json({ ok: false as const, error: rebuilt.error }, { status, headers: NO_STORE });
    }

    // 4) Durate dei mesocicli.
    for (const m of changed) {
      const { error } = await admin
        .from("training_plan_mesocycle")
        .update({ weeks: wanted.get(m.id) })
        .eq("id", m.id)
        .eq("plan_id", planId);
      if (error) {
        return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
      }
    }

    // 5) Settimane: prima le DELETE (liberano date), poi UPDATE, poi INSERT.
    const deletes = rebuilt.ops.filter((o) => o.kind === "delete");
    if (deletes.length > 0) {
      const ids = deletes.map((o) => (o.kind === "delete" ? o.id : "")).filter(Boolean);
      const { error } = await admin.from("training_plan_week").delete().in("id", ids).eq("plan_id", planId);
      if (error) {
        return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
      }
    }
    for (const op of rebuilt.ops) {
      if (op.kind !== "update") continue;
      const { error } = await admin
        .from("training_plan_week")
        .update({
          week_start: op.weekStart,
          phase: op.phase,
          week_in_phase: op.weekInPhase,
          mesocycle_id: op.mesocycleId,
          budget_tss: op.budgetTss,
          sessions: op.sessions,
          hours_target: op.hoursTarget,
          objectives: op.objectives ?? {},
          coach_notes: op.coachNotes,
          family_mix: op.familyMix ?? { aerobic_pct: 100, gym_pct: 0 },
        })
        .eq("id", op.id)
        .eq("plan_id", planId);
      if (error) {
        return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
      }
    }
    const inserts = rebuilt.ops.filter((o) => o.kind === "insert");
    if (inserts.length > 0) {
      const payload = inserts.map((op) => {
        const o = op as Extract<typeof op, { kind: "insert" }>;
        return {
          plan_id: planId,
          week_start: o.weekStart,
          phase: o.phase,
          week_in_phase: o.weekInPhase,
          mesocycle_id: o.mesocycleId,
          budget_tss: o.budgetTss,
          sessions: o.sessions,
          hours_target: o.hoursTarget,
          objectives: o.objectives ?? {},
          coach_notes: o.coachNotes,
          family_mix: o.familyMix ?? { aerobic_pct: 100, gym_pct: 0 },
          workout_count: 0,
        };
      });
      const { error } = await admin.from("training_plan_week").insert(payload);
      if (error) {
        return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
      }
    }

    // 6) La fine del piano segue le durate.
    const { error: planUpdErr } = await admin
      .from("training_plan")
      .update({ end_date: rebuilt.endDate })
      .eq("id", planId);
    if (planUpdErr) {
      return NextResponse.json({ ok: false as const, error: planUpdErr.message }, { status: 500, headers: NO_STORE });
    }

    // 7) Piano già vivo → il calendario segue lo scheletro (purge+regenerate futuro).
    let materialized = 0;
    let publishedCount = 0;
    if (plan.status === "approved" || plan.status === "active") {
      const run = await materializeTrainingMacro(admin, {
        planId,
        weeks: { mode: "runway", minFutureWeeks: 3 },
      });
      if (!run.ok) {
        return NextResponse.json(
          { ok: false as const, error: run.error, reshaped: true },
          { status: 500, headers: NO_STORE },
        );
      }
      materialized = run.materialized.length;
      publishedCount = run.publishedCount;
    }

    return NextResponse.json(
      {
        ok: true as const,
        planId,
        changed: changed.length,
        totalWeeks: rebuilt.totalWeeks,
        endDate: rebuilt.endDate,
        inserted: inserts.length,
        deleted: deletes.length,
        materialized,
        publishedCount,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "plan reshape failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
