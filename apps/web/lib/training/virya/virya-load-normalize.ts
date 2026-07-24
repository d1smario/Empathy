/**
 * Riconciliazione carichi settimanali → budget (VIRYA microciclo).
 *
 * ESTRATTO da `virya-microcycle-planner.ts` (F3 motore builder): è matematica
 * pura senza alcuna configurazione, e serve sia al planner client legacy sia al
 * motore L2 bundle-abile (`lib/training/l2/materialize-week-builder-engine.ts`).
 * Il planner legacy contiene ANCHE la copia hardcoded di pattern/sequenze/pesi
 * che il blueprint vieta nel bundle Edge Function: separare la matematica dalla
 * config permette al motore L2 di importare SOLO questa, mai la copia.
 */

/**
 * Slot "elastici" su cui distribuire le correzioni di arrotondamento: gli slot
 * dispari e l'ultimo (tipicamente volume/coda settimana) assorbono il delta,
 * gli slot quality mantengono il carico prescritto.
 */
function rolesElasticAt(index: number, total: number): boolean {
  return index % 2 === 1 || index === total - 1;
}

/** Riconcilia somma carichi al budget (±3%). Deterministica, mai throw. */
export function normalizeWeeklyLoad(loads: number[], targetBudget: number): number[] {
  const target = Math.max(0, Math.round(targetBudget));
  if (!loads.length) return [];
  if (target <= 0) return loads.map(() => 0);

  let out = [...loads];
  let sum = out.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    const each = Math.max(1, Math.round(target / out.length));
    out = out.map(() => each);
    sum = out.reduce((a, b) => a + b, 0);
  }

  const tolerance = Math.max(3, Math.round(target * 0.03));
  let guard = 0;
  while (Math.abs(sum - target) > tolerance && guard < 48) {
    guard += 1;
    const delta = target - sum;
    const elasticIdx: number[] = [];
    for (let i = 0; i < out.length; i += 1) {
      if (rolesElasticAt(i, out.length)) elasticIdx.push(i);
    }
    const idx =
      elasticIdx.length > 0
        ? elasticIdx[guard % elasticIdx.length]!
        : guard % out.length;
    const next = out[idx]! + (delta > 0 ? 1 : -1);
    if (next < 1) continue;
    out[idx] = next;
    sum = out.reduce((a, b) => a + b, 0);
  }
  return out;
}
