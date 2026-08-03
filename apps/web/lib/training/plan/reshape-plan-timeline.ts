import type { PlanPhase } from "@/lib/training/plan/plan-skeleton-types";
import { addDaysIso } from "@/lib/training/propose-training-macro";

/**
 * Ricalcolo della linea temporale del piano quando il coach cambia la DURATA di un
 * mesociclo (leva «lunghezza dei periodi» della spec coach).
 *
 * Perché serve un ricalcolo e non un semplice UPDATE: le settimane sono righe con
 * date assolute (`week_start`). Allungare la fase base di 2 settimane sposta in
 * avanti di 14 giorni TUTTE le settimane successive, cambia `week_in_phase` e fa
 * nascere/morire righe. Qui si calcolano le operazioni; l'applicazione al DB (che
 * richiede service-role: il coach non ha INSERT/DELETE su training_plan_week) sta
 * nella route.
 *
 * DUE REGOLE DI SICUREZZA:
 * 1. Si ricalcola SOLO da `fromSeq` in avanti: i mesocicli precedenti e le loro
 *    settimane non si toccano mai (il passato materializzato resta coerente).
 * 2. Un mesociclo GIÀ INIZIATO non è ridimensionabile (`mesocycle_already_started`):
 *    cambiare la durata di una fase in corso sposterebbe date già vissute
 *    dall'atleta e già materializzate in calendario.
 *
 * CONSERVAZIONE DEGLI EDIT: le impostazioni del coach (carico, sedute, ore, stimoli,
 * note) seguono la POSIZIONE LOGICA `(mesocycleSeq, weekInPhase)`, non la data — «la
 * 2ª settimana della costruzione» resta la 2ª settimana della costruzione anche se
 * slitta di 14 giorni. Le settimane nuove nascono dai default del mesociclo.
 */

export type ReshapeMesocycle = {
  id: string;
  seq: number;
  phase: PlanPhase;
  /** Durata RICHIESTA (già validata 1..16 dal chiamante). */
  weeks: number;
  weeklyTssTarget: number | null;
  sessionsTarget: number | null;
};

export type ReshapeWeek = {
  id: string;
  weekStart: string;
  /** seq del mesociclo padre (risolto dal chiamante via mesocycle_id). */
  mesocycleSeq: number | null;
  weekInPhase: number;
  budgetTss: number;
  sessions: number;
  hoursTarget: number | null;
  objectives: unknown;
  coachNotes: string | null;
  familyMix: unknown;
};

/** Payload comune alle righe nuove/aggiornate (colonne DB in camelCase). */
export type ReshapeWeekPayload = {
  weekStart: string;
  phase: PlanPhase;
  weekInPhase: number;
  mesocycleId: string;
  budgetTss: number;
  sessions: number;
  hoursTarget: number | null;
  objectives: unknown;
  coachNotes: string | null;
  familyMix: unknown;
};

export type ReshapeOp =
  | ({ kind: "update"; id: string } & ReshapeWeekPayload)
  | ({ kind: "insert" } & ReshapeWeekPayload)
  | { kind: "delete"; id: string };

export type ReshapeResult =
  | { ok: true; ops: ReshapeOp[]; totalWeeks: number; endDate: string }
  | { ok: false; error: "mesocycle_already_started" | "no_anchor" | "empty_plan" };

/** Lunedì (ISO) della settimana che contiene `iso`. */
export function isoWeekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const dow = d.getUTCDay(); // 0=dom
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDaysIso(iso, delta);
}

export function rebuildPlanTimeline(args: {
  mesocycles: readonly ReshapeMesocycle[];
  weeks: readonly ReshapeWeek[];
  /** Prima seq con durata cambiata: da qui in avanti si ricalcola. */
  fromSeq: number;
  /** Oggi (ISO) — per il guard «mesociclo già iniziato». */
  todayIso: string;
}): ReshapeResult {
  const mesos = [...args.mesocycles].sort((a, b) => a.seq - b.seq);
  if (mesos.length === 0) return { ok: false, error: "empty_plan" };
  const weeks = [...args.weeks].sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0));

  // Ancora = data di inizio del primo mesociclo ricalcolato. Se quel mesociclo ha
  // già settimane, è la loro prima data; altrimenti è la settimana successiva
  // all'ultima del mesociclo precedente (mesociclo vuoto: caso raro ma legale).
  const firstOfFrom = weeks.find((w) => w.mesocycleSeq === args.fromSeq);
  let anchor: string | null = firstOfFrom?.weekStart ?? null;
  if (!anchor) {
    const before = weeks.filter((w) => (w.mesocycleSeq ?? 0) < args.fromSeq);
    anchor = before.length > 0 ? addDaysIso(before[before.length - 1]!.weekStart, 7) : (weeks[0]?.weekStart ?? null);
  }
  if (!anchor) return { ok: false, error: "no_anchor" };

  // Guard: non si ridimensiona una fase già iniziata (o passata).
  if (anchor < isoWeekStart(args.todayIso)) {
    return { ok: false, error: "mesocycle_already_started" };
  }

  // Le settimane PRIMA dell'ancora restano intatte; quelle da lì in poi sono la
  // materia prima del ricalcolo (per conservare gli edit) e le superstiti vanno
  // cancellate se non trovano posizione.
  const replaced = weeks.filter((w) => w.weekStart >= anchor!);
  const byPosition = new Map<string, ReshapeWeek>();
  for (const w of replaced) {
    if (w.mesocycleSeq == null) continue;
    byPosition.set(`${w.mesocycleSeq}:${w.weekInPhase}`, w);
  }

  const ops: ReshapeOp[] = [];
  const consumed = new Set<string>();
  let cursor = anchor;

  for (const meso of mesos) {
    if (meso.seq < args.fromSeq) continue;
    const weeksCount = Math.max(1, Math.round(meso.weeks));
    for (let w = 1; w <= weeksCount; w += 1) {
      const key = `${meso.seq}:${w}`;
      const prev = byPosition.get(key);
      const payload: ReshapeWeekPayload = {
        weekStart: cursor,
        phase: meso.phase,
        weekInPhase: w,
        mesocycleId: meso.id,
        // Edit del coach conservati per posizione logica; settimana nuova → default
        // del mesociclo (e `objectives` null → il mapper deriva lo stimolo di fase).
        budgetTss: prev?.budgetTss ?? Math.max(0, Math.round(meso.weeklyTssTarget ?? 0)),
        sessions: prev?.sessions ?? Math.max(0, Math.round(meso.sessionsTarget ?? 0)),
        hoursTarget: prev?.hoursTarget ?? null,
        objectives: prev?.objectives ?? {},
        coachNotes: prev?.coachNotes ?? null,
        familyMix: prev?.familyMix ?? { aerobic_pct: 100, gym_pct: 0 },
      };
      if (prev) {
        consumed.add(prev.id);
        ops.push({ kind: "update", id: prev.id, ...payload });
      } else {
        ops.push({ kind: "insert", ...payload });
      }
      cursor = addDaysIso(cursor, 7);
    }
  }

  // Superstiti senza posizione (piano accorciato) → via.
  for (const w of replaced) {
    if (!consumed.has(w.id)) ops.push({ kind: "delete", id: w.id });
  }

  const keptBefore = weeks.length - replaced.length;
  const emitted = ops.filter((o) => o.kind !== "delete").length;
  return {
    ok: true,
    ops,
    totalWeeks: keptBefore + emitted,
    // `cursor` è la settimana DOPO l'ultima emessa: l'ultimo giorno del piano è il
    // giorno prima del suo lunedì.
    endDate: addDaysIso(cursor, -1),
  };
}
