import { addIsoDays, mondayOfIsoWeek, normalizeIsoDayKey } from "@/lib/dates/iso-day-arithmetic";

/**
 * FONTE 3 del volume di allenamento: le sedute che il COACH ha già messo in CALENDARIO
 * (`planned_workouts`). È la più autorevole delle tre perché è un FATTO, non una
 * dichiarazione: le altre due sono i campi di profilo (`training_days_per_week`,
 * `training_max_session_minutes`) e la routine `routine_config.week_plan`.
 *
 * Modulo PURO: nessun I/O. Chi legge il DB passa qui le righe già caricate, così la regola
 * è testabile senza database ed è la stessa per i due consumatori (il generatore
 * `deriveTrainingWeekParams` e il gate di onboarding `onboarding-completeness`).
 *
 * ── LA FINESTRA (perché 4 settimane ISO intere in avanti) ──
 * Osserviamo `[lunedì della settimana dell'ancora, +28 giorni)`, cioè la settimana
 * dell'ancora più le 3 successive. Le ragioni, una per una:
 *  - **settimane ISO INTERE, non «da oggi in poi»**: se l'atleta apre la app di giovedì,
 *    le sedute che il coach gli ha messo lunedì e martedì sono comunque prova del suo
 *    volume settimanale. Contare solo il futuro le perderebbe e renderebbe il risultato
 *    dipendente dal giorno in cui si guarda (non deterministico a parità di dati).
 *  - **4 settimane**: è il mesociclo classico e copre il caso reale del coach che
 *    programma 2-3 settimane avanti. Una finestra di 1 settimana lo mancherebbe ogni
 *    volta che la settimana corrente è già stata consumata.
 *  - **in avanti, non all'indietro**: il volume serve a DIMENSIONARE ciò che verrà; le
 *    settimane passate sono storia (e l'eseguito vive in un'altra tabella). Conseguenza
 *    accettata e voluta: se il coach non ha programmato nulla né questa settimana né
 *    nelle 3 successive, il calendario smette di essere una prova e tornano a valere le
 *    fonti dichiarate — che è esattamente il «ripiego» previsto.
 *
 * ── I CONTEGGI ──
 *  - «giorno di allenamento» = DATA DISTINTA con almeno una seduta. Due sedute lo stesso
 *    giorno (doppia mattina/sera) fanno 1 giorno, non 2: il parametro `sessions` del
 *    generatore è un numero di GIORNI allenabili nella settimana.
 *  - `daysPerWeek` = MASSIMO fra le settimane della finestra che hanno almeno una seduta,
 *    non la media. Motivo: una settimana di SCARICO con 2 sole sedute è una riduzione
 *    voluta rispetto al volume strutturale dell'atleta; mediarla abbasserebbe per sempre
 *    la sua capacità dichiarata. Le settimane a zero sedute non entrano nel calcolo:
 *    «il coach non l'ha ancora toccata» non è «l'atleta non si allena».
 *  - `maxSessionMinutes` = MASSIMO di `planned_workouts.duration_minutes` nella finestra.
 *    È la misura del PICCO, e serve solo come CAP (quanto può durare una seduta di questo
 *    atleta). La colonna è NOT NULL a schema (verificato su prod: 0 righe con valore nullo
 *    o ≤ 0 su 979), ma il tipo TS resta tollerante e i valori non finiti o ≤ 0 vengono
 *    ignorati: se NESSUNA seduta ha una durata utile il campo torna `null` e il chiamante
 *    ricade sulla fonte dichiarata, invece di inventare uno zero.
 *  - `avgDayMinutes` = minuti MEDI per giorno di allenamento (somma delle durate del
 *    giorno, mediata sui giorni che hanno almeno una durata utile). Serve al MONTE-ORE, ed
 *    è una grandezza diversa dal picco: usare `maxSessionMinutes` per dimensionare la
 *    settimana significa moltiplicare l'outlier per il numero di giorni e gonfiare il
 *    monte-ore rispetto al calendario stesso. Numeri reali letti su prod (finestra
 *    2026-08-10): atleta 1a0a63b8 → 7 giorni, picco 316′, ma 1125′ in calendario; con il
 *    picco (clampato a 240′) verrebbero 28,0 h contro le 18,8 h davvero programmate
 *    (+49%). Con la media per giorno (161′) tornano 18,8 h. Non è un numero decorativo:
 *    `l2/materialize-week-builder-engine.ts` SCALA le durate delle sedute per avvicinarsi
 *    a `hoursTarget`, quindi l'errore si trasferisce alle sedute generate.
 */

/** Riga minima di `planned_workouts` che serve al calcolo. */
export type PlannedWorkoutVolumeRow = {
  date?: string | null;
  duration_minutes?: number | string | null;
};

export type CalendarTrainingVolume = {
  /** Primo giorno osservato (lunedì), incluso. */
  windowStart: string;
  /** Primo giorno NON osservato, escluso. */
  windowEndExclusive: string;
  /** Sedute nella finestra (righe, non giorni). */
  sessionCount: number;
  /** Settimane della finestra con almeno una seduta. */
  weeksWithSessions: number;
  /** Giorni allenabili della settimana più carica della finestra (1..7). */
  daysPerWeek: number;
  /** Durata massima osservata in minuti (PICCO, usata come cap), `null` se assente. */
  maxSessionMinutes: number | null;
  /**
   * Minuti medi per GIORNO di allenamento (somma del giorno, mediata sui giorni con
   * almeno una durata utile). Descrittivo: NON usarlo per dimensionare la settimana —
   * moltiplicarlo per `daysPerWeek` incrocia una media di finestra con un massimo di
   * settimana. Per il monte-ore c'è `maxWeeklyMinutes`.
   */
  avgDayMinutes: number | null;
  /**
   * Minuti della settimana PIÙ CARICA della finestra: l'unica grandezza che dimensiona un
   * monte-ore settimanale senza inventare una settimana che non esiste. `null` se nessuna
   * seduta ha una durata utilizzabile.
   */
  maxWeeklyMinutes: number | null;
};

/** Settimane ISO intere osservate a partire da quella dell'ancora. */
export const CALENDAR_VOLUME_WINDOW_WEEKS = 4;

function positiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Estrae il volume settimanale osservabile dal calendario.
 * Ritorna `null` quando nella finestra non c'è NESSUNA seduta: è il segnale «il calendario
 * non dice nulla», distinto da «il calendario dice zero» (che non esiste come dichiarazione).
 *
 * `anchorIsoDay` è la settimana di riferimento: il generatore passa la settimana che sta
 * costruendo, il gate di onboarding passa il giorno corrente.
 */
export function observeCalendarTrainingVolume(
  rows: readonly PlannedWorkoutVolumeRow[] | null | undefined,
  anchorIsoDay: string,
): CalendarTrainingVolume | null {
  const windowStart = mondayOfIsoWeek(anchorIsoDay);
  const windowEndExclusive = addIsoDays(windowStart, CALENDAR_VOLUME_WINDOW_WEEKS * 7);

  // Chiave = lunedì della settimana della seduta; valore = insieme delle date distinte.
  const daysByWeek = new Map<string, Set<string>>();
  // Minuti totali per GIORNO, solo per i giorni che hanno almeno una durata utile:
  // i giorni senza durata non devono trascinare giù la media (sarebbero degli zeri finti).
  const minutesByDay = new Map<string, number>();
  let sessionCount = 0;
  let maxSessionMinutes: number | null = null;

  for (const row of rows ?? []) {
    if (typeof row?.date !== "string" || row.date.trim() === "") continue;
    const day = normalizeIsoDayKey(row.date);
    // Confronto lessicografico: su `YYYY-MM-DD` equivale all'ordine cronologico.
    if (day < windowStart || day >= windowEndExclusive) continue;

    sessionCount += 1;
    const weekKey = mondayOfIsoWeek(day);
    const set = daysByWeek.get(weekKey) ?? new Set<string>();
    set.add(day);
    daysByWeek.set(weekKey, set);

    const minutes = positiveInt(row.duration_minutes);
    if (minutes != null) {
      if (maxSessionMinutes == null || minutes > maxSessionMinutes) maxSessionMinutes = minutes;
      // Doppia seduta nello stesso giorno: i minuti si SOMMANO (il giorno resta uno solo).
      minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + minutes);
    }
  }

  if (sessionCount === 0) return null;

  let daysPerWeek = 0;
  for (const set of daysByWeek.values()) {
    if (set.size > daysPerWeek) daysPerWeek = set.size;
  }

  let avgDayMinutes: number | null = null;
  if (minutesByDay.size > 0) {
    let total = 0;
    for (const m of minutesByDay.values()) total += m;
    avgDayMinutes = Math.round(total / minutesByDay.size);
  }

  /**
   * Minuti della settimana PIÙ CARICA — stessa aggregazione di `daysPerWeek` (massimo fra
   * le settimane), e per lo stesso motivo: entrambi descrivono il picco che il coach ha
   * programmato, quindi vanno letti sulla stessa settimana.
   *
   * Perché non `daysPerWeek × avgDayMinutes`: sarebbe un prodotto incrociato fra un MASSIMO
   * (i giorni) e una MEDIA sull'intera finestra (i minuti), che non corrisponde a nessuna
   * settimana esistente. Caso reale che lo rompe: 6 giorni da 60′ nella settimana vicina più
   * una sola uscita lunga da 180′ in ognuna delle 3 successive (è la forma tipica — il coach
   * dettaglia la settimana prossima e mette avanti solo i lunghi). Media per giorno 100′ ×
   * 6 giorni = 600′, contro i 360′ della settimana davvero più carica: +67% inventato. E il
   * monte-ore non resta un numero: `l2/materialize-week-builder-engine` scala su di esso la
   * durata delle sedute generate (fino a 1,6×), e questo valore fa da seme a TUTTE le
   * settimane del macrociclo, non a una.
   */
  let maxWeeklyMinutes: number | null = null;
  for (const days of daysByWeek.values()) {
    let weekTotal = 0;
    let hasMinutes = false;
    for (const day of days) {
      const m = minutesByDay.get(day);
      if (m != null) {
        weekTotal += m;
        hasMinutes = true;
      }
    }
    if (hasMinutes && (maxWeeklyMinutes == null || weekTotal > maxWeeklyMinutes)) {
      maxWeeklyMinutes = weekTotal;
    }
  }

  return {
    windowStart,
    windowEndExclusive,
    sessionCount,
    weeksWithSessions: daysByWeek.size,
    daysPerWeek: Math.min(7, daysPerWeek),
    maxSessionMinutes,
    avgDayMinutes,
    maxWeeklyMinutes,
  };
}
