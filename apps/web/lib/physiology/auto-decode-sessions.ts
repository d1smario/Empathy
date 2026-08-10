/**
 * "Auto-decode attivo: N sessioni analizzate" — contatore della riga sotto ai form lab.
 *
 * `/api/physiology/history` alimenta i valori auto (lattato / max-ox) leggendo una
 * FINESTRA MOBILE delle ultime {@link AUTO_DECODE_SESSION_WINDOW} sedute di
 * `executed_workouts` (order by date desc, limit N). Il conteggio è quindi sempre
 * `min(sedute_totali, finestra)`: in produzione ogni atleta ha più di 24 sedute
 * (min. 33, max. 373 al 2026-08-11), quindi la vecchia etichetta mostrava
 * PERMANENTEMENTE "24 sessioni analizzate" e non cambiava mai — vera come numero,
 * ma leggibile come "ho analizzato tutto il tuo storico", che è falso.
 *
 * Qui si decide quale etichetta usare: se la finestra è satura si dichiara anche il
 * totale reale ("ultime 24 su 373"), altrimenti resta l'etichetta semplice.
 */

/** Ampiezza della finestra mobile di `executed_workouts` usata dai valori auto. */
export const AUTO_DECODE_SESSION_WINDOW = 24;

export type AutoDecodeLabel =
  | { key: "autoDecodeActive"; sessionsAnalyzed: number }
  | { key: "autoDecodeActiveWindow"; sessionsAnalyzed: number; sessionsTotal: number };

/**
 * @param analyzed sedute effettivamente passate al decoder (righe lette, mai > finestra).
 * @param total sedute totali dell'atleta in `executed_workouts`; `null` se il conteggio
 *   non è disponibile (query fallita): in quel caso si degrada all'etichetta semplice,
 *   mai a un totale inventato.
 * @returns `null` quando non c'è nulla da dichiarare (zero sedute analizzate).
 */
export function resolveAutoDecodeLabel(input: { analyzed: number; total: number | null }): AutoDecodeLabel | null {
  const analyzed = Number.isFinite(input.analyzed) ? Math.trunc(input.analyzed) : 0;
  if (analyzed <= 0) return null;
  const total = input.total != null && Number.isFinite(input.total) ? Math.trunc(input.total) : null;
  if (total != null && total > analyzed) {
    return { key: "autoDecodeActiveWindow", sessionsAnalyzed: analyzed, sessionsTotal: total };
  }
  return { key: "autoDecodeActive", sessionsAnalyzed: analyzed };
}
