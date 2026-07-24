import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeTrainingMacro } from "@/lib/training/materialize-training-macro";
import { proposeTrainingMacro } from "@/lib/training/propose-training-macro";

/**
 * Continuità del training (VIRYA F2, split proponi/materializza — blueprint D):
 * se all'atleta resta poca «pista» futura, prima si CONSUMA lo scheletro del piano
 * esistente (settimane L1 non ancora materializzate), e solo se il piano è esaurito
 * si PROPONE il blocco successivo col doppio ramo coach/no-coach.
 *
 * REGOLA RUNWAY (esplicita, non accidentale — blueprint D, regola 1): il conteggio
 * della pista guarda QUALUNQUE `planned_workouts`, incluse le sedute costruite a
 * mano dal coach. Un coach che pianifica ≥3 settimane sopprime quindi l'auto-gen:
 * «il coach domina il motore» è una regola di prodotto, non un effetto collaterale.
 *
 * KNOWN GAP [F9], accettato per il perimetro F2: questa funzione gira SOLO dentro
 * il cron nutrizione del martedì (`app/api/nutrition/weekly-replan/cron`). Un
 * atleta SENZA nutrition_plan attivo non ha continuità training per tutta F2/F3.
 * Il fan-out in `/api/cron/daily` che chiude il gap è deliverable F4 NON negoziabile.
 */
export type EnsureContinuityResult =
  | {
      ok: true;
      extended: false;
      maxFuture: string | null;
      /**
       * Perché non si è esteso: runway sufficiente, draft in attesa del coach
       * (proposto ora o preesistente), o scheletro integro ma calendario svuotato
       * a mano (non ripopoliamo ciò che l'utente ha cancellato di proposito).
       */
      reason: "runway_ok" | "draft_pending_coach" | "skeleton_intact";
      proposedPlanId?: string;
    }
  | { ok: true; extended: true; startMonday: string; workoutCount: number; planId: string }
  | { ok: false; error: string };

const MIN_FUTURE_WEEKS = 3;

function isoUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDaysUTC(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoUTC(d);
}
function daysBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(`${bIso}T00:00:00Z`).getTime() - new Date(`${aIso}T00:00:00Z`).getTime()) / 86_400_000);
}
function mondayOnOrAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=dom
  const delta = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + delta);
  return isoUTC(d);
}

export async function ensureTrainingContinuity(
  db: SupabaseClient,
  athleteId: string,
  opts?: { minFutureWeeks?: number; todayIso?: string },
): Promise<EnsureContinuityResult> {
  const minFuture = opts?.minFutureWeeks ?? MIN_FUTURE_WEEKS;
  const today = opts?.todayIso ?? isoUTC(new Date());

  // Runway: QUALUNQUE seduta pianificata conta (anche coach — vedi regola sopra).
  const { data: rows, error } = await db
    .from("planned_workouts")
    .select("date")
    .eq("athlete_id", athleteId)
    .gte("date", today)
    .order("date", { ascending: false })
    .limit(1);
  if (error) return { ok: false, error: error.message };

  const maxFuture = ((rows ?? []) as Array<Record<string, unknown>>)[0]?.date;
  const maxFutureIso = typeof maxFuture === "string" ? maxFuture.slice(0, 10) : null;

  if (maxFutureIso && daysBetween(today, maxFutureIso) >= minFuture * 7) {
    return { ok: true, extended: false, maxFuture: maxFutureIso, reason: "runway_ok" };
  }

  // Ramo (a): piano approved|active esistente con scheletro ancora da consumare →
  // si MATERIALIZZA quello, NON se ne crea uno nuovo (lo scheletro è la fonte).
  const { data: planRows, error: planErr } = await db
    .from("training_plan")
    .select("id, status, created_at")
    .eq("athlete_id", athleteId)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (planErr) return { ok: false, error: planErr.message };
  const plan = ((planRows ?? []) as Array<{ id?: string }>)[0];
  const planId = typeof plan?.id === "string" ? plan.id : null;

  if (planId) {
    // Settimane non ancora materializzate (workout_count=0) e non concluse.
    const { data: pendingRows, error: pendingErr } = await db
      .from("training_plan_week")
      .select("week_start")
      .eq("plan_id", planId)
      .eq("workout_count", 0)
      .gte("week_start", addDaysUTC(today, -6))
      .order("week_start", { ascending: true });
    if (pendingErr) return { ok: false, error: pendingErr.message };
    const pending = ((pendingRows ?? []) as Array<Record<string, unknown>>)
      .map((r) => String(r.week_start ?? "").slice(0, 10))
      .filter(Boolean);

    if (pending.length > 0) {
      const m = await materializeTrainingMacro(db, {
        planId,
        weeks: { mode: "runway", minFutureWeeks: minFuture },
        todayIso: today,
      });
      if (!m.ok) return { ok: false, error: m.error };
      if (m.materialized.length > 0) {
        return {
          ok: true,
          extended: true,
          startMonday: m.materialized[0]!,
          workoutCount: m.publishedCount,
          planId,
        };
      }
    }

    // Piano NON esaurito (l'ultima settimana scheletro copre oltre l'orizzonte) ma
    // runway corta e niente da materializzare: il calendario è stato svuotato a
    // mano. Non ripopoliamo — rigenereremmo esattamente ciò che è stato cancellato.
    const { data: lastRows, error: lastErr } = await db
      .from("training_plan_week")
      .select("week_start")
      .eq("plan_id", planId)
      .order("week_start", { ascending: false })
      .limit(1);
    if (lastErr) return { ok: false, error: lastErr.message };
    const lastStart = ((lastRows ?? []) as Array<Record<string, unknown>>)[0]?.week_start;
    const lastStartIso = typeof lastStart === "string" ? lastStart.slice(0, 10) : null;
    const exhausted = !lastStartIso || daysBetween(today, addDaysUTC(lastStartIso, 6)) < minFuture * 7;
    if (!exhausted) {
      return { ok: true, extended: false, maxFuture: maxFutureIso, reason: "skeleton_intact" };
    }
  }

  // Draft preesistente in attesa del coach: NON si ri-propone (archivierebbe il
  // draft che il coach sta revisionando, churn inutile). Si aspetta l'approvazione.
  const { data: draftRows, error: draftErr } = await db
    .from("training_plan")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("status", "draft")
    .limit(1);
  if (draftErr) return { ok: false, error: draftErr.message };
  const draftId = ((draftRows ?? []) as Array<{ id?: string }>)[0]?.id;
  if (typeof draftId === "string" && draftId) {
    return {
      ok: true,
      extended: false,
      maxFuture: maxFutureIso,
      reason: "draft_pending_coach",
      proposedPlanId: draftId,
    };
  }

  // Ramo (b): piano esaurito o assente → PROPOSTA del blocco successivo, accodato
  // dopo l'ultimo pianificato (senza sovrapposizioni), col doppio ramo coach/no-coach.
  const startMonday = mondayOnOrAfter(maxFutureIso ? addDaysUTC(maxFutureIso, 1) : today);
  const p = await proposeTrainingMacro(db, { athleteId, startDate: startMonday, source: "continuity" });
  if (!p.ok) return { ok: false, error: p.error };
  if (p.status === "draft") {
    return {
      ok: true,
      extended: false,
      maxFuture: maxFutureIso,
      reason: "draft_pending_coach",
      proposedPlanId: p.planId,
    };
  }
  const m = await materializeTrainingMacro(db, {
    planId: p.planId,
    weeks: { mode: "runway", minFutureWeeks: minFuture },
    todayIso: today,
  });
  if (!m.ok) return { ok: false, error: m.error };
  return { ok: true, extended: true, startMonday, workoutCount: m.publishedCount, planId: p.planId };
}
