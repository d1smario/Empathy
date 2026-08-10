/**
 * VO₂max canonico: chi vince fra il **run metabolico** e il **test di laboratorio**.
 *
 * La colonna `physiological_profiles.vo2max_ml_min_kg` ha DUE scrittori indipendenti:
 * - `/api/physiology/snapshot` (sezione `metabolic_profile`), che scrive colonna + run;
 * - `/api/physiology/vo2max-lab` (sezione `vo2max_lab`), che scrive colonna + run e, sul
 *   DELETE, azzera la colonna.
 *
 * `resolveCanonicalPhysiologyState` è **run-first**: leggendo solo i run
 * `metabolic_profile`, il valore di laboratorio di un atleta che ha anche un run
 * metabolico non entrava mai nel canonico (e la sua cancellazione era invisibile).
 * Risultato: la card Fisiologia mostrava la colonna mentre `/api/profile`,
 * `/api/nutrition` e `/api/training/engine/generate` mostravano il run — due VO₂max
 * diversi per lo stesso atleta, in modo permanente.
 *
 * Qui la precedenza è **per recenza fra i due eventi**: vince l'ultimo che ha toccato il
 * dato. Cancellare il laboratorio toglie la misura di laboratorio, non la stima
 * metabolica: dopo un DELETE si ricade sul run metabolico, se c'è.
 *
 * Modulo PURO (zero import) proprio perché lo stesso criterio va poter essere provato
 * senza DB.
 */

/** Un evento che ha scritto il VO₂max. `value: null` = l'evento lo CANCELLA. */
export type Vo2maxEvent = {
  /** `created_at` del run, ISO. Non ordinabile (assente o non parsabile) = perde. */
  createdAt: string | null;
  /** Valore in ml/min/kg, oppure `null` quando l'evento è una cancellazione. */
  value: number | null;
};

function timeOf(event: Vo2maxEvent | null): number | null {
  if (!event?.createdAt) return null;
  const ms = Date.parse(event.createdAt);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * VO₂max dai soli run. `null` = nessun run lo determina → il chiamante prosegue con la
 * colonna e con i run `max_oxidate`, come prima.
 */
export function resolveVo2maxFromEvents(input: {
  metabolic: Vo2maxEvent | null;
  lab: Vo2maxEvent | null;
}): number | null {
  const { metabolic, lab } = input;
  if (!lab) return metabolic?.value ?? null;
  if (!metabolic) return lab.value;

  const labMs = timeOf(lab);
  const metabolicMs = timeOf(metabolic);
  // Ordine impossibile da stabilire → si tiene il comportamento storico (run metabolico
  // per primo), che è quello su cui i numeri in produzione sono già allineati.
  if (labMs == null || metabolicMs == null) return metabolic.value ?? lab.value;

  // Il laboratorio vince solo se è STRETTAMENTE più recente: a parità di istante il run
  // metabolico resta la fonte, com'era prima di questo modulo.
  if (labMs > metabolicMs) return lab.value ?? metabolic.value;
  return metabolic.value ?? lab.value;
}
