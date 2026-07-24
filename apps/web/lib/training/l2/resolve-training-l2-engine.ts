/**
 * Commutatore motore L2 (VIRYA rework F3): decide quale motore materializza le
 * settimane scheletro in `planned_workouts`.
 *
 * - `db` (DEFAULT, invariato): RPC Postgres `generate_training_week` + publish.
 * - `builder`: catena TS del Builder (preset/archetipi + gymRx catalogo-first),
 *   stessa funzione pura riusata dalla futura Edge Function.
 *
 * ATTIVAZIONE SOLO VIA ENV — così il QA su utentetest non tocca nessun altro:
 * - `TRAINING_L2_ENGINE=builder` → builder per TUTTI (flip globale, post-QA);
 * - `TRAINING_L2_BUILDER_ATHLETES=<uuid,uuid>` → allowlist per-atleta (shadow/QA).
 * Qualsiasi altro valore (assente, "db", refusi) → `db`: il default non cambia
 * mai per sbaglio. L'allowlist vale anche con TRAINING_L2_ENGINE non impostata.
 */

export type TrainingL2Engine = "db" | "builder";

export function resolveTrainingL2Engine(
  athleteId: string,
  env: Record<string, string | undefined> = process.env,
): TrainingL2Engine {
  const globalFlag = (env.TRAINING_L2_ENGINE ?? "").trim().toLowerCase();
  if (globalFlag === "builder") return "builder";

  const allowlist = (env.TRAINING_L2_BUILDER_ATHLETES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.includes(athleteId.trim().toLowerCase())) return "builder";

  return "db";
}
