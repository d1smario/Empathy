/**
 * Costruttore MACRO deterministico: la sequenza di fasi periodizzate (la «vision d'insieme»)
 * che `generate_training_plan_custom(p_phases)` materializza. Evita il buco «un mese cieco →
 * sempre carico o sempre scarico»: gli scarichi e la progressione sono PIAZZATI nella stagione.
 *
 * Fasi ammesse dalla RPC: base | build | refine | peak | deload | second_peak.
 * - Goal-driven (gara con data): base→build con scarichi, poi refine + peak sulla gara.
 * - Open-ended (nessuna gara): arco rolling base→build con scarico (il cron di scorrimento estende).
 */

export type MacroPhaseType = "base" | "build" | "refine" | "peak" | "deload" | "second_peak";
export type MacroPhase = { phase: MacroPhaseType; weeks: number };

const LOAD_RUN_BEFORE_DELOAD = 3; // 3 settimane di carico → 1 di scarico
const DEFAULT_OPEN_HORIZON_WEEKS = 8;

function weeksBetween(startIso: string, endIso: string): number | null {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000);
  if (days <= 0) return null;
  return Math.max(1, Math.round(days / 7));
}

/** Accoda una settimana di carico del tipo dato, fondendo con l'ultima fase se contigua. */
function pushLoadWeek(phases: MacroPhase[], phase: MacroPhaseType): void {
  const last = phases[phases.length - 1];
  if (last && last.phase === phase) last.weeks += 1;
  else phases.push({ phase, weeks: 1 });
}

function buildGoalDrivenPhases(totalWeeks: number): MacroPhase[] {
  // Riserva le ultime 2 settimane a refine + peak (affinamento + picco sulla gara).
  const body = Math.max(1, totalWeeks - 2);
  const baseWeeks = Math.max(1, Math.round(body * 0.5)); // prima metà base, seconda build
  const phases: MacroPhase[] = [];
  let assigned = 0;
  let loadRun = 0;
  while (assigned < body) {
    if (loadRun >= LOAD_RUN_BEFORE_DELOAD) {
      phases.push({ phase: "deload", weeks: 1 });
      loadRun = 0;
      assigned += 1;
      continue;
    }
    pushLoadWeek(phases, assigned < baseWeeks ? "base" : "build");
    loadRun += 1;
    assigned += 1;
  }
  phases.push({ phase: "refine", weeks: 1 });
  phases.push({ phase: "peak", weeks: 1 });
  return phases;
}

function buildOpenEndedPhases(horizonWeeks: number): MacroPhase[] {
  const phases: MacroPhase[] = [];
  let assigned = 0;
  let loadRun = 0;
  const baseWeeks = Math.max(1, Math.round(horizonWeeks * 0.5));
  while (assigned < horizonWeeks) {
    if (loadRun >= LOAD_RUN_BEFORE_DELOAD) {
      phases.push({ phase: "deload", weeks: 1 });
      loadRun = 0;
      assigned += 1;
      continue;
    }
    pushLoadWeek(phases, assigned < baseWeeks ? "base" : "build");
    loadRun += 1;
    assigned += 1;
  }
  return phases;
}

export function buildMacroPhases(input: {
  startDate: string;
  goalEventDate?: string | null;
  openHorizonWeeks?: number;
}): MacroPhase[] {
  const goalWeeks = input.goalEventDate ? weeksBetween(input.startDate, input.goalEventDate) : null;
  if (goalWeeks != null && goalWeeks >= 4) {
    return buildGoalDrivenPhases(goalWeeks);
  }
  return buildOpenEndedPhases(Math.max(4, input.openHorizonWeeks ?? DEFAULT_OPEN_HORIZON_WEEKS));
}

/** Totale settimane coperte dal macro (per calcolare la data di fine). */
export function macroTotalWeeks(phases: MacroPhase[]): number {
  return phases.reduce((sum, p) => sum + Math.max(1, p.weeks), 0);
}
