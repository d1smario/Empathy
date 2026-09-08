import type {
  IntelligentMealPlanSlotOut,
  IntelligentMealPlanSolverBasis,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { sumVisibleSlotMacros } from "@/lib/nutrition/meal-exposition-helpers";

/**
 * LE DUE ENERGIE DELLA GIORNATA, CIASCUNA COL SUO NOME.
 *
 * In cima al Piano convivevano quattro numeri della stessa giornata e nessuno leggeva gli
 * altri: il KPI ricalcolato dal browser a ogni apertura (solver V1, un modello energetico
 * DIVERSO da quello che ha generato il piano — su Milesi BMR 1822 contro 1606), le basi del
 * piano (`solverBasis.slots`: l'unico target che il motore ha davvero usato, mai stampato
 * come numero), il servito delle card e il servito del DB.
 *
 * Qui dentro ne restano due, e sono due cose legittimamente diverse:
 *  · il TARGET — il budget su cui il piano è stato costruito. Viene dal piano; il ricalcolo
 *    live resta solo come ripiego per il giorno in cui un piano non c'è ancora, e in quel
 *    caso `source` vale `estimate` perché la pagina lo dica invece di spacciarlo per target;
 *  · il SERVITO — la somma delle porzioni scelte, la stessa che l'atleta legge sulle card.
 *
 * Non si fanno quadrare: divergono su circa due terzi dei piani, ed è normale che le porzioni
 * reali non cadano esatte sul budget. Quello che non è normale è non sapere quale numero si
 * sta leggendo.
 */

export type DayMacroTotals = { kcal: number; carbs: number; protein: number; fat: number };

/** Riga della griglia Diet ricalcolata dal browser (ripiego quando il piano manca). */
export type DayEnergyLiveRow = {
  key: string;
  label: string;
  pct: number;
  time: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

export type PlanBasisSlot = IntelligentMealPlanSolverBasis["slots"][number];

/**
 * Forma minima del piano che serve qui: le voci servite e le basi del solver. Volutamente
 * più stretta di `IntelligentMealPlanResponseBody` — così il test può costruirne uno senza
 * riempire mezzo contratto.
 */
export type PlanDayEnergyPlanLike = {
  slots: IntelligentMealPlanSlotOut[];
  solverBasis?: { slots?: PlanBasisSlot[] | null } | null;
};

/** Da dove viene il numero grosso in cima: dal piano generato, o da una stima del profilo. */
export type DayEnergyTargetSource = "plan" | "estimate";

export type PlanDayEnergy = {
  source: DayEnergyTargetSource;
  target: DayMacroTotals;
  /** Null quando non c'è un piano: senza voci non esiste un «nel piatto» da mostrare. */
  served: DayMacroTotals | null;
  /** (servito − target) / target sulle kcal. Negativo = nel piatto c'è meno del target. */
  servedDeltaPct: number | null;
  /** Oltre soglia: la pagina lo spiega a parole. Nessun semaforo — non è un allarme. */
  servedDiverges: boolean;
};

/** Oltre questo scarto relativo la pagina spiega a parole perché i due numeri non coincidono. */
export const DAY_ENERGY_DIVERGENCE_THRESHOLD = 0.05;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function zeroTotals(): DayMacroTotals {
  return { kcal: 0, carbs: 0, protein: 0, fat: 0 };
}

function finish(t: DayMacroTotals): DayMacroTotals {
  return {
    kcal: Math.round(t.kcal),
    carbs: round1(t.carbs),
    protein: round1(t.protein),
    fat: round1(t.fat),
  };
}

/** Il target del piano: la somma delle basi che il motore ha usato per costruirlo. */
export function sumPlanBasisTargets(slots: readonly PlanBasisSlot[]): DayMacroTotals {
  const acc = zeroTotals();
  for (const s of slots) {
    acc.kcal += s.targetKcal;
    acc.carbs += s.targetCarbsG;
    acc.protein += s.targetProteinG;
    acc.fat += s.targetFatG;
  }
  return finish(acc);
}

/** La stima del browser: vale solo finché un piano non c'è. */
export function sumLiveEstimateTargets(rows: readonly DayEnergyLiveRow[]): DayMacroTotals {
  const acc = zeroTotals();
  for (const r of rows) {
    acc.kcal += r.kcal;
    acc.carbs += r.carbs;
    acc.protein += r.protein;
    acc.fat += r.fat;
  }
  return finish(acc);
}

/**
 * Il servito del giorno: la somma pasto per pasto delle stesse cifre che stanno in testa
 * alle card (`sumVisibleSlotMacros`), incluse le sue regole — voci nascoste dal coach fuori
 * dal conto, e pasto senza voci che ricade sul target dello slot, perché lì il target è
 * l'unico numero disponibile ed è quello che la card mostra. Chi somma le card deve
 * ritrovarsi il totale in cima: è la stessa richiesta del nutrizionista sui totali di pasto.
 */
export function sumPlanServedMacros(
  plan: PlanDayEnergyPlanLike | null | undefined,
  isItemVisible?: (slot: MealSlotKey, index: number) => boolean,
): DayMacroTotals | null {
  const basis = plan?.solverBasis?.slots;
  if (!plan || !basis?.length) return null;
  const bySlot = new Map(plan.slots.map((s) => [s.slot, s]));
  const acc = zeroTotals();
  for (const meta of basis) {
    const fallback = {
      kcal: meta.targetKcal,
      carbsG: meta.targetCarbsG,
      proteinG: meta.targetProteinG,
      fatG: meta.targetFatG,
    };
    const served = bySlot.get(meta.slot);
    const totals = served
      ? sumVisibleSlotMacros(served, (i) => (isItemVisible ? isItemVisible(meta.slot, i) : true), fallback)
      : fallback;
    acc.kcal += totals.kcal;
    acc.carbs += totals.carbsG;
    acc.protein += totals.proteinG;
    acc.fat += totals.fatG;
  }
  return finish(acc);
}

/** Le due energie del giorno, con il nome di ciascuna e lo scarto fra loro. */
export function resolvePlanDayEnergy(input: {
  plan: PlanDayEnergyPlanLike | null | undefined;
  liveRows: readonly DayEnergyLiveRow[];
  isItemVisible?: (slot: MealSlotKey, index: number) => boolean;
}): PlanDayEnergy {
  const basis = input.plan?.solverBasis?.slots;
  if (!basis?.length) {
    return {
      source: "estimate",
      target: sumLiveEstimateTargets(input.liveRows),
      served: null,
      servedDeltaPct: null,
      servedDiverges: false,
    };
  }
  const target = sumPlanBasisTargets(basis);
  const served = sumPlanServedMacros(input.plan, input.isItemVisible);
  const servedDeltaPct =
    served && target.kcal > 0 ? (served.kcal - target.kcal) / target.kcal : null;
  return {
    source: "plan",
    target,
    served,
    servedDeltaPct,
    servedDiverges: servedDeltaPct != null && Math.abs(servedDeltaPct) > DAY_ENERGY_DIVERGENCE_THRESHOLD,
  };
}

export type PlanWorkspaceRowBase = {
  key: MealSlotKey | string;
  label: string;
  pct: number;
  time: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

/**
 * Le righe dei pasti esposti quando il piano c'è: TUTTE dalle basi del piano.
 *
 * Prima era un ibrido per-slot — la riga live vinceva ogni volta che lo slot esisteva anche
 * nella griglia Diet locale, e le basi coprivano solo gli slot che la griglia non aveva. Con
 * lo stesso set di slot (il caso normale) significava che nessun numero per pasto veniva dal
 * piano: su Milesi, 2026-09-08, colazione 836 invece di 766, pranzo 976 invece di 766, cena
 * 697 invece di 656. Sistemare il totale in cima senza sistemare questo lasciava il singolo
 * pasto ricalcolato lo stesso.
 *
 * Dalla riga live restano solo etichetta, orario e percentuale quando le basi non li hanno:
 * sono cosmetica, non energia.
 */
export function buildPlanWorkspaceRowBases<T extends PlanWorkspaceRowBase>(
  basisSlots: readonly PlanBasisSlot[] | null | undefined,
  liveRows: readonly T[],
): (T | PlanWorkspaceRowBase)[] {
  if (!basisSlots?.length) return [...liveRows];
  const byKey = new Map(liveRows.map((r) => [String(r.key), r]));
  return basisSlots.map((s) => {
    const live = byKey.get(s.slot);
    return {
      key: s.slot,
      label: s.labelIt?.trim() || live?.label || s.slot,
      pct: live?.pct ?? 0,
      time: s.scheduledTimeLocal?.trim() || live?.time || "",
      kcal: s.targetKcal,
      carbs: s.targetCarbsG,
      protein: s.targetProteinG,
      fat: s.targetFatG,
    };
  });
}
