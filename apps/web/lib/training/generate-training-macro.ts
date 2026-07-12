import type { SupabaseClient } from "@supabase/supabase-js";
import {
  publishDbWorkoutsToCalendar,
  readDbEngineWorkouts,
  type PublishDbWorkoutsResult,
} from "@/lib/training/db-engine/publish-db-workouts";
import type { MacroPhase } from "@/lib/training/build-macro-phases";

/**
 * Materializza un MACRO periodizzato (multi-settimana) e lo pubblica sul calendario.
 * Compone: RPC `generate_training_plan_custom(p_phases)` (progressione build, taper peak/deload,
 * scarichi — periodizzazione coerente in un colpo) → `readDbEngineWorkouts` → `publishDbWorkoutsToCalendar`
 * (idempotente su planned_workouts). Sostituisce il generatore a 1 settimana: niente più blocchi ciechi.
 */
export type GenerateTrainingMacroResult =
  | { ok: true; planId: string; workoutCount: number; publish: PublishDbWorkoutsResult }
  | { ok: false; error: string };

function extractPlanId(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const v = (first as Record<string, unknown>).generate_training_plan_custom ?? Object.values(first)[0];
      if (typeof v === "string") return v;
    }
  }
  if (data && typeof data === "object") {
    const v = (data as Record<string, unknown>).generate_training_plan_custom;
    if (typeof v === "string") return v;
  }
  return null;
}

export async function generateAndPublishTrainingMacro(
  db: SupabaseClient,
  params: {
    athleteId: string;
    startDate: string;
    phases: MacroPhase[];
    discipline?: string;
    family?: string;
    chips?: string[];
    goalText?: string;
  },
): Promise<GenerateTrainingMacroResult> {
  if (!Array.isArray(params.phases) || params.phases.length === 0) {
    return { ok: false, error: "macro senza fasi" };
  }
  const { data, error } = await db.rpc("generate_training_plan_custom", {
    p_athlete_id: params.athleteId,
    p_start: params.startDate,
    p_phases: params.phases,
    p_discipline: params.discipline ?? "cycling",
    p_family: params.family ?? "aerobic",
    p_chips: params.chips ?? [],
    p_goal_text: params.goalText ?? "",
  });
  if (error) return { ok: false, error: `generate_training_plan_custom: ${error.message}` };
  const planId = extractPlanId(data);
  if (!planId) return { ok: false, error: "generate_training_plan_custom: nessun plan id" };

  const { data: wkRows, error: wkErr } = await db.from("workout").select("id").eq("plan_id", planId);
  if (wkErr) return { ok: false, error: `lettura workout del piano: ${wkErr.message}` };
  const ids = ((wkRows ?? []) as Array<Record<string, unknown>>).map((r) => String(r.id ?? "")).filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "il piano non ha prodotto workout" };

  const details = await readDbEngineWorkouts(db, ids);
  const publish = await publishDbWorkoutsToCalendar(db, details);
  return { ok: true, planId, workoutCount: ids.length, publish };
}
