/**
 * «Questa seduta è stata saltata?» — la domanda che decide se alleggerire i pasti rimasti.
 *
 * Come sbagliava. La risposta era: «esiste un'esecuzione COLLEGATA a questa pianificata?».
 * Ma il collegamento lo scrive solo l'import manuale — la sincronizzazione Garmin non lo
 * scrive mai — e in produzione ce l'ha il 2,3% delle esecuzioni. Così un atleta che si era
 * allenato, con l'orologio che lo aveva registrato, risultava «saltato» e si vedeva tagliare
 * i pasti. Le due sole riduzioni mai avvenute in produzione erano entrambe di questo tipo.
 *
 * Come risponde adesso: «esiste una traccia di allenamento che possa essere questa seduta?».
 * Il collegamento resta la prova migliore, ma non è più l'unica ammessa: vale anche
 * un'esecuzione non collegata che cade nella finestra della seduta. E quando l'esecuzione non
 * ha un orario utilizzabile, non si dichiara nulla — non sappiamo escludere che sia lei.
 *
 * Il principio: si alleggerisce solo quando NON C'È TRACCIA di allenamento. Nel dubbio si
 * lascia il piano com'è, perché togliere cibo a chi si è allenato è l'errore che fa più danno.
 */

export type PlannedSessionForSkip = {
  id: string;
  /** Minuti locali dell'orario di inizio; `null` = orario ignoto → non si dichiara mai saltata. */
  scheduledMin: number | null;
  durationMin: number;
};

export type ExecutedTraceForSkip = {
  /** Pianificata a cui l'esecuzione è collegata, quando il collegamento esiste. */
  plannedWorkoutId: string | null;
  /** Minuti locali di inizio; `null` = orario ignoto (o assente sul 13% delle righe). */
  startedAtMin: number | null;
  durationMin: number | null;
};

/**
 * Tolleranza sull'aggancio per orario. Una seduta non parte al minuto: due ore su ciascun
 * lato coprono il ritardo normale senza arrivare a coprire una seduta diversa della giornata.
 */
export const OVERLAP_TOLERANCE_MIN = 120;

/** Le due finestre si toccano, dopo aver allargato quella pianificata della tolleranza. */
function windowsOverlap(planned: PlannedSessionForSkip, exec: ExecutedTraceForSkip): boolean {
  if (planned.scheduledMin == null || exec.startedAtMin == null) return false;
  const pStart = planned.scheduledMin - OVERLAP_TOLERANCE_MIN;
  const pEnd = planned.scheduledMin + Math.max(0, planned.durationMin) + OVERLAP_TOLERANCE_MIN;
  const eStart = exec.startedAtMin;
  const eEnd = exec.startedAtMin + Math.max(0, exec.durationMin ?? 0);
  return eStart <= pEnd && eEnd >= pStart;
}

export type SkipResolution = {
  skippedIds: Set<string>;
  /** Perché una pianificata NON è stata dichiarata saltata: utile in log e in test. */
  keptReasonById: Map<string, "finestra_non_passata" | "orario_ignoto" | "collegata" | "orario_compatibile" | "esecuzione_senza_orario">;
};

export function resolveSkippedPlannedIds(input: {
  planned: readonly PlannedSessionForSkip[];
  executed: readonly ExecutedTraceForSkip[];
  nowLocalMin: number;
  marginMin: number;
}): SkipResolution {
  const skippedIds = new Set<string>();
  const keptReasonById: SkipResolution["keptReasonById"] = new Map();

  const linkedIds = new Set(
    input.executed.map((e) => (e.plannedWorkoutId ?? "").trim()).filter((v) => v !== ""),
  );
  /**
   * Esecuzioni senza collegamento E senza orario: non possiamo né agganciarle né escluderle.
   * La loro sola esistenza basta a non dichiarare saltata nessuna seduta della giornata.
   */
  const hasUntimedOrphan = input.executed.some(
    (e) => !(e.plannedWorkoutId ?? "").trim() && e.startedAtMin == null,
  );

  for (const p of input.planned) {
    if (p.scheduledMin == null) {
      keptReasonById.set(p.id, "orario_ignoto");
      continue;
    }
    if (p.scheduledMin + Math.max(0, p.durationMin) + input.marginMin >= input.nowLocalMin) {
      keptReasonById.set(p.id, "finestra_non_passata");
      continue;
    }
    if (linkedIds.has(p.id)) {
      keptReasonById.set(p.id, "collegata");
      continue;
    }
    if (input.executed.some((e) => !(e.plannedWorkoutId ?? "").trim() && windowsOverlap(p, e))) {
      keptReasonById.set(p.id, "orario_compatibile");
      continue;
    }
    if (hasUntimedOrphan) {
      keptReasonById.set(p.id, "esecuzione_senza_orario");
      continue;
    }
    skippedIds.add(p.id);
  }

  return { skippedIds, keptReasonById };
}

/**
 * Minuti locali di un istante ISO nel fuso dell'atleta. Fuso assente o non valido → UTC,
 * come fa già il resto del file: meglio un orario approssimato che nessun aggancio.
 */
export function localMinutesFromIso(iso: unknown, tz: string | null): number | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const s = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz ?? "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  } catch {
    /* fuso non valido → sotto, in UTC */
  }
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
