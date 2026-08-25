/**
 * Logica PURA della ripianificazione settimanale (martedì): scelta dei bersagli,
 * suddivisione del lavoro in invocazioni e costruzione del riepilogo.
 *
 * Sta fuori dalla route perché è la parte che si può verificare con test senza DB
 * né rete — e perché la route ora ha due facce (dispatcher / worker) che devono
 * concordare sugli stessi numeri.
 */

/**
 * Ampiezza della finestra entro cui una data passata a mano è considerata plausibile.
 * 21 giorni copre con margine gli usi legittimi (la settimana bersaglio sta a +6..+12
 * giorni da oggi; rilanciare a mano il martedì saltato la settimana prima sta a -7) e
 * taglia fuori l'errore di battitura sull'anno o sul mese.
 */
export const OVERRIDE_DATE_WINDOW_DAYS = 21;

/** Millisecondi UTC di una data ISO, `null` se non è una data di calendario vera. */
function parseIsoDateUTC(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d, 12);
  const back = new Date(ms);
  // Il costruttore fa rotolare il 31 febbraio sul 3 marzo: se non torna identica, non esiste.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

/**
 * Le date `?weekStart=` / `?referenceDate=` arrivano da un umano (percorso ops, dietro
 * CRON_SECRET) e non si fermano alla lettura: `referenceDate` finisce a
 * `ensureTrainingContinuity`, che MATERIALIZZA settimane su `training_plan_week` e
 * `planned_workouts`. La sola forma `YYYY-MM-DD` non basta: un anno sbagliato battendo a
 * mano scriverebbe pianificazione a un orizzonte assurdo, e nessuno se ne accorgerebbe.
 * Qui si chiede anche che la data ESISTA e sia vicina a oggi.
 */
export function isPlausibleOverrideDate(iso: string, todayIso: string, windowDays = OVERRIDE_DATE_WINDOW_DAYS): boolean {
  const target = parseIsoDateUTC(iso);
  const today = parseIsoDateUTC(todayIso);
  if (target == null || today == null) return false;
  return Math.abs(target - today) <= windowDays * 86_400_000;
}

/** Lunedì della settimana SUCCESSIVA (UTC). Mai la settimana corrente: regola di prodotto. */
export function nextMondayUTC(now: Date): string {
  const x = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = x.getUTCDay(); // 0=dom
  x.setUTCDate(x.getUTCDate() + (day === 0 ? -6 : 1 - day)); // lunedì corrente
  x.setUTCDate(x.getUTCDate() + 7); // → settimana successiva
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Bersagli effettivi: candidati (piano recente, oppure il singolo override ops) filtrati
 * per diritto d'uso. Deduplica preservando l'ordine — un id ripetuto diventerebbe DUE
 * invocazioni concorrenti sullo stesso atleta, e il persist «replace per data» non è
 * protetto da un vincolo di unicità su (athlete_id, plan_date): due scritture in parallelo
 * sullo stesso giorno lascerebbero due piani. La dedup è la barriera.
 */
export function selectWeeklyReplanTargets(
  candidateIds: readonly string[],
  entitled: ReadonlySet<string>,
  /**
   * PRONTI a ricevere un piano: profilo con i dati che il generatore usa davvero (oggi il
   * PESO). Assente = nessun filtro, comportamento storico.
   *
   * Perché serve un filtro esplicito invece di lasciar fare al generatore: senza peso il
   * solver energetico ricade su 70 kg e produce un piano lo stesso — un piano CALCOLATO SU
   * UN DATO INVENTATO, che è peggio di nessun piano per chi lo riceve. Meglio restare
   * fuori dalla platea e comparire nel riepilogo come «non pronto», così chi guarda sa
   * che quella persona esiste e cosa le manca.
   */
  ready?: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidateIds) {
    const id = (raw ?? "").trim();
    if (!id || seen.has(id) || !entitled.has(id)) continue;
    seen.add(id);
    if (ready && !ready.has(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * Chi ha diritto ma NON è pronto: l'elenco che il riepilogo del cron deve riportare.
 * Sono persone che pagano e non ricevono nulla — se restano invisibili, restano ferme
 * per mesi (misurato il 25 ago 2026: 13 abbonati senza peso in scheda, il più vecchio
 * iscritto da 127 giorni).
 */
export function weeklyReplanNotReady(
  candidateIds: readonly string[],
  entitled: ReadonlySet<string>,
  ready: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidateIds) {
    const id = (raw ?? "").trim();
    if (!id || seen.has(id) || !entitled.has(id)) continue;
    seen.add(id);
    if (!ready.has(id)) out.push(id);
  }
  return out;
}

/**
 * Suddivisione del ventaglio. Con `size >= items.length` restituisce UN solo gruppo:
 * è il caso normale (tutte le fetch partono nello stesso tick, quindi ogni atleta ha
 * la sua invocazione serverless avviata anche se il dispatcher viene ucciso subito dopo).
 * I gruppi successivi al primo partono solo dopo il precedente: sono una valvola contro
 * il carico, non il percorso normale.
 */
export function chunkForFanOut<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export type WeeklyReplanFanOutItem = {
  athleteId: string;
  ok: boolean;
  /** Giorni effettivamente scritti (0..7) — `null` se la risposta del worker non è arrivata. */
  days: number | null;
  daysTotal: number | null;
  status?: number;
  error?: string;
};

export type WeeklyReplanFanOutSummary = {
  dispatched: number;
  athletesOk: number;
  athletesFailed: number;
  /** Somma dei giorni scritti: è IL numero che dice se il martedì ha prodotto qualcosa. */
  daysWritten: number;
  daysExpected: number;
  /** Atleti la cui risposta non è tornata: il lavoro può essere comunque riuscito (vedi traccia DB). */
  unknown: number;
  failures: Array<{ athleteId: string; error: string }>;
};

const MAX_FAILURES_IN_SUMMARY = 20;

/** Riepilogo leggibile da chi apre la risposta del cron (o la riga di traccia su empathy_events). */
export function summarizeWeeklyReplanFanOut(items: readonly WeeklyReplanFanOutItem[]): WeeklyReplanFanOutSummary {
  const failures: Array<{ athleteId: string; error: string }> = [];
  let athletesOk = 0;
  let daysWritten = 0;
  let daysExpected = 0;
  let unknown = 0;
  for (const it of items) {
    if (it.ok) athletesOk++;
    else failures.push({ athleteId: it.athleteId, error: it.error ?? (it.status ? `HTTP ${it.status}` : "errore sconosciuto") });
    if (it.days == null) unknown++;
    else daysWritten += it.days;
    daysExpected += it.daysTotal ?? 7;
  }
  return {
    dispatched: items.length,
    athletesOk,
    athletesFailed: items.length - athletesOk,
    daysWritten,
    daysExpected,
    unknown,
    failures: failures.slice(0, MAX_FAILURES_IN_SUMMARY),
  };
}
