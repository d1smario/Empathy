import { PLANNED_SESSION_DURATION_MAX_MIN } from "@/lib/training/builder/session-duration-choices";

/** Allineamento soft ai guardrail V1 — senza dipendere da `planned-operational-guardrail` (porting incrementale). */
export type PlannedWorkoutInsertPayload = {
  athlete_id: string;
  date: string;
  type: string;
  duration_minutes: number;
  tss_target: number;
  kcal_target: number | null;
  kj_target?: number | null;
  /**
   * Identità piano L1 (colonna F1 VIRYA): valorizzato SOLO dalle righe materializzate
   * dal motore (`materializeTrainingMacro`). Le righe coach restano senza plan_id —
   * è il criterio con cui L2 non le tocca mai (blueprint sezione D, regola 3).
   */
  plan_id?: string | null;
  notes: string | null;
};

export function clampPlannedWorkoutRow(row: PlannedWorkoutInsertPayload): PlannedWorkoutInsertPayload {
  const type = row.type.trim().slice(0, 120) || "pro2_builder";
  const duration = Math.max(1, Math.min(PLANNED_SESSION_DURATION_MAX_MIN, Math.round(Number(row.duration_minutes) || 0)));
  const tss = Math.max(0, Math.min(999, Math.round(Number(row.tss_target) || 0)));
  let kcal: number | null = null;
  if (row.kcal_target != null && Number.isFinite(Number(row.kcal_target))) {
    kcal = Math.max(0, Math.min(20000, Math.round(Number(row.kcal_target))));
  }
  let kj: number | null = null;
  if (row.kj_target != null && Number.isFinite(Number(row.kj_target))) {
    kj = Math.max(0, Math.min(50000, Math.round(Number(row.kj_target))));
  }
  // plan_id passa intatto (uuid o assente): il clamp non deve mai staccare una riga dal suo piano.
  const planId = typeof row.plan_id === "string" && row.plan_id.trim() ? row.plan_id.trim() : null;
  return {
    athlete_id: row.athlete_id.trim(),
    date: row.date.trim().slice(0, 10),
    type,
    duration_minutes: duration,
    tss_target: tss,
    kcal_target: kcal,
    kj_target: kj,
    plan_id: planId,
    notes: row.notes && row.notes.trim() ? row.notes.trim().slice(0, 32000) : null,
  };
}
