/**
 * `external_event_id` per i record Polar.
 *
 * L'indice unico di produzione è `(provider, external_event_id)` — SENZA `athlete_id`.
 * Sonno e nightly-recharge non hanno un id lato Polar: sono aggregati per giorno. Ricavarli dalla
 * sola data li rende identici fra atleti diversi, quindi la chiave DEVE portare l'atleta dentro.
 */

/** Esercizio: Polar espone un id proprio, già univoco a livello di provider. */
export function polarExerciseExternalId(rec: Record<string, unknown>): string | null {
  return typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : null;
}

/** Aggregati giornalieri (`sleep`, `recharge`): nessun id lato Polar. */
export function polarDailyExternalId(input: {
  kind: "sleep" | "recharge";
  athleteId: string;
  rec: Record<string, unknown>;
}): string | null {
  const date = typeof input.rec.date === "string" && input.rec.date.trim() ? input.rec.date.trim() : null;
  if (!date) return null;
  return `${input.kind}:${input.athleteId}:${date}`;
}
