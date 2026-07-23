/**
 * B6 — blocco governato dai MINUTI (default) o dalla DISTANZA (km).
 * Il motore resta a TEMPO: la distanza è solo un modo di INPUT, risolto in secondi
 * con la velocità di riferimento UNICA di sessione (`renderProfile.speedRefKmh`).
 * Le DUE espansioni (builder: `resolveBlockDurationSeconds` in manual-plan-block;
 * calendario/export: `blockDurationSeconds` in pro2-structured-interval-ladder)
 * passano da qui — SPECULARI o niente.
 */

export type BlockLengthMode = "time" | "distance";

/** v1: solo steady e ramp possono essere governati dalla distanza (piramide ESCLUSA). */
export function kindSupportsDistanceMode(kind: string | undefined): boolean {
  const k = (kind ?? "").toLowerCase();
  return k === "steady" || k === "ramp";
}

/**
 * km / vel. rif. (km/h) → secondi interi.
 * Stessi guard della V1 a sessione: km clamp ≥ 0.1, velocità ≥ 1, floor 30 s
 * (come i blocchi a tempo).
 */
export function distanceModeDurationSeconds(distanceKm: number | undefined, refSpeedKmh: number): number {
  const km = Math.max(0.1, distanceKm || 0);
  return Math.max(30, Math.round((km / Math.max(1, refSpeedKmh)) * 3600));
}
