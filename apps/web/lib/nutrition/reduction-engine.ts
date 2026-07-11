/**
 * Motore di RIDUZIONE (loop adattivo, breve periodo) — PURO e DETERMINISTICO.
 *
 * Quando un allenamento programmato NON risulta fatto (finestra passata, nessun executed
 * collegato), la quota-pasti prevista per quell'allenamento non serve → si alleggeriscono i
 * PASTI RIMANENTI del giorno corrente. Regole:
 *  - capata dalla capacità dei pasti ancora davanti (mai il giorno dopo);
 *  - se non resta nulla da alleggerire (già mangiato) → niente (lo assorbe il settimanale);
 *  - reversibile: se l'attività compare dopo, la riduzione si azzera (ricalcolo).
 *
 * Non tocca l'acqua (senza sforzo il sudore è minore, ma l'idratazione base resta). Solo cibo.
 */

export type ReductionInput = {
  /** Quota-pasti (kcal) attribuibile agli allenamenti saltati (dal delta del solver). */
  skippedMealKcal: number;
  /** Capacità dei pasti ancora davanti a ora (somma kcal dei pasti non ancora consumati). */
  remainingMealsCapacityKcal: number;
};

export type Reduction = {
  triggered: boolean;
  reductionKcal: number;
  reason: string | null;
};

/** Sotto questa soglia non vale la pena ritoccare. */
export const REDUCTION_MIN_KCAL = 120;

export function computeReduction(input: ReductionInput): Reduction {
  const want = Math.max(0, Math.round(Number(input.skippedMealKcal) || 0));
  const cap = Math.max(0, Math.round(Number(input.remainingMealsCapacityKcal) || 0));
  const reductionKcal = Math.min(want, cap);

  if (reductionKcal < REDUCTION_MIN_KCAL || cap <= 0) {
    return { triggered: false, reductionKcal: 0, reason: null };
  }
  const reason = `Allenamento programmato non risultante svolto: alleggerisco i pasti rimanenti di ${reductionKcal} kcal (nessuno spreco: il cibo resta per un altro giorno).`;
  return { triggered: true, reductionKcal, reason };
}
