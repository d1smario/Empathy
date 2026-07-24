import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAuthenticatedTrainingUser,
} from "@/lib/auth/athlete-read-context";
import { assertPlatformEntitlementForApi } from "@/lib/billing/assert-platform-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { materializeTrainingMacro } from "@/lib/training/materialize-training-macro";
import { archiveSupersededPlans } from "@/lib/training/propose-training-macro";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * APPROVAZIONE piano L1 (VIRYA F2, blueprint D punto 4): «il coach ha approvato»
 * → flip `draft→approved` + materializzazione immediata della runway.
 *
 * Perché un endpoint e non un UPDATE diretto browser→Supabase: il flip di status
 * da solo NON basta — la materializzazione scrive `planned_workouts` e richiede
 * service-role (nessuna INSERT policy per il coach, by design). Questo è il
 * percorso azione MINIMO; F3 lo sposterà nella Edge Function
 * `materialize-training-week` con il gate status IN-FUNCTION [F4].
 *
 * GATE (service-role SOLO dopo): (1) il piano si legge col client RLS del caller —
 * un draft è visibile SOLO a coach-in-scope e platform admin (policy F1/F5: la
 * select_own dell'atleta esclude i draft), quindi la RLS È il gate di scope;
 * (2) cintura sul ruolo: solo coach o platform admin approvano (coach-costruisce/
 * atleta-riceve — un atleta non deve approvarsi il piano da solo).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { planId?: unknown } | null;
    const planId = typeof body?.planId === "string" ? body.planId.trim() : "";
    if (!planId) {
      return NextResponse.json({ ok: false as const, error: "missing_planId" }, { status: 400, headers: NO_STORE });
    }

    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    // Stesso gate paywall delle altre route training (throw → catch con status 402).
    await assertPlatformEntitlementForApi(userId, rlsClient);

    // 1) Scope via RLS: fuori scope (o atleta su un draft) la riga semplicemente
    //    non esiste → 404 unico, nessun oracle su piani altrui.
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

    // 2) Cintura ruolo (la propria riga app_user_profiles è leggibile via RLS).
    const { data: callerRow } = await rlsClient
      .from("app_user_profiles")
      .select("role, is_platform_admin")
      .eq("user_id", userId)
      .maybeSingle();
    const caller = callerRow as { role?: string | null; is_platform_admin?: boolean | null } | null;
    if (caller?.role !== "coach" && caller?.is_platform_admin !== true) {
      return NextResponse.json({ ok: false as const, error: "forbidden" }, { status: 403, headers: NO_STORE });
    }

    if (plan.status !== "draft") {
      return NextResponse.json(
        { ok: false as const, error: "plan_not_draft", status: plan.status },
        { status: 409, headers: NO_STORE },
      );
    }

    // 3) Da qui in poi service-role (SOLO dopo il gate).
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        { ok: false as const, error: "service_role_required" },
        { status: 503, headers: NO_STORE },
      );
    }

    // Flip condizionato su status='draft': due approvazioni concorrenti → una sola vince.
    const { data: flipped, error: flipErr } = await admin
      .from("training_plan")
      .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("status", "draft")
      .select("id");
    if (flipErr) {
      return NextResponse.json({ ok: false as const, error: flipErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!flipped || flipped.length === 0) {
      return NextResponse.json(
        { ok: false as const, error: "plan_not_draft" },
        { status: 409, headers: NO_STORE },
      );
    }

    // Supersessione all'approvazione (blueprint D.5): ogni ALTRO piano non-archived
    // dell'atleta si archivia e il suo futuro materializzato sparisce — due piani
    // sovrapposti non devono materializzare entrambi.
    const fromDateIso = (plan.start_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const superseded = await archiveSupersededPlans(admin, plan.athlete_id, {
      keepPlanId: planId,
      fromDateIso,
    });
    if (!superseded.ok) {
      return NextResponse.json({ ok: false as const, error: superseded.error }, { status: 500, headers: NO_STORE });
    }

    const materialize = await materializeTrainingMacro(admin, {
      planId,
      weeks: { mode: "runway", minFutureWeeks: 3 },
    });
    if (!materialize.ok) {
      return NextResponse.json(
        { ok: false as const, error: materialize.error, approved: true },
        { status: 500, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        ok: true as const,
        planId,
        status: "approved" as const,
        approvedBy: userId,
        archivedPlanIds: superseded.archivedPlanIds,
        materialized: materialize.materialized,
        skipped: materialize.skipped,
        errors: materialize.errors,
        publishedCount: materialize.publishedCount,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "plan approve failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
