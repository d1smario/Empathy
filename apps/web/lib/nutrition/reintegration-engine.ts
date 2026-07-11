/**
 * Motore di REINTEGRO post-allenamento — DETERMINISTICO e PURO (loop adattivo, breve periodo).
 *
 * Confronta il fabbisogno pasti STIMATO (dal pianificato) con quello OSSERVATO (dal consumo
 * reale del device, Decisione B). Se hai speso più del previsto oltre una soglia, produce un
 * reintegro come EXTRA (kcal + carbo + acqua) da aggiungere sopra il piano del giorno.
 *
 * Regola d'oro: solo AGGIUNTA qui (delta positivo). Riduzione = motore separato.
 */

export type ReintegrationInput = {
  /** meals kcal del solver SENZA osservato (piano). */
  estimatedMealsKcal: number;
  /** meals kcal del solver CON osservato device. */
  observedMealsKcal: number;
  /** Durata allenamento del giorno (min) — solo per il testo del motivo. */
  trainingDurationMin?: number;
};

export type Reintegration = {
  triggered: boolean;
  extraKcal: number;
  extraCarbsG: number;
  extraWaterMl: number;
  /** Integratori consigliati (regole deterministiche sullo sforzo). Sempre come extra opzionale. */
  supplements: string[];
  reason: string | null;
};

/** Regole integratori deterministiche in base a entità del reintegro e sudore. */
function reintegrationSupplements(extraKcal: number, extraWaterMl: number, trained: boolean): string[] {
  const out: string[] = [];
  if (extraWaterMl >= 900) out.push("Elettroliti (sodio + potassio) per reintegrare i sali persi");
  if (trained && extraKcal >= 400) out.push("Proteine per il recupero muscolare (20–25 g)");
  return out;
}

/** Sotto questa soglia non vale la pena reintegrare (rumore di misura). */
export const REINTEGRATION_MIN_DELTA_KCAL = 150;

export function computeReintegration(input: ReintegrationInput): Reintegration {
  const delta = Math.round((Number(input.observedMealsKcal) || 0) - (Number(input.estimatedMealsKcal) || 0));

  if (delta < REINTEGRATION_MIN_DELTA_KCAL) {
    return { triggered: false, extraKcal: 0, extraCarbsG: 0, extraWaterMl: 0, supplements: [], reason: null };
  }

  const extraKcal = delta;
  // Post-sforzo: prevalenza carboidrati per reintegrare le scorte (~60% dell'extra energetico).
  const extraCarbsG = Math.round((extraKcal * 0.6) / 4);
  // Acqua: sudore dallo sforzo extra. Ore-extra stimate dal delta (~600 kcal/h moderato) × ~700 ml/h,
  // arrotondato a 50 ml.
  const extraHours = extraKcal / 600;
  const extraWaterMl = Math.round((extraHours * 700) / 50) * 50;

  const trained = (input.trainingDurationMin ?? 0) > 0;
  const supplements = reintegrationSupplements(extraKcal, extraWaterMl, trained);
  const reason = `Hai speso circa ${extraKcal} kcal in più del previsto${trained ? " nell'allenamento" : ""}: reintegro scorte (${extraCarbsG} g carboidrati) e liquidi (${extraWaterMl} ml).`;

  return { triggered: true, extraKcal, extraCarbsG, extraWaterMl, supplements, reason };
}
