/**
 * Innesto del day-classification-engine (classi/quote giornaliere di Mario) nel percorso
 * di generazione V2 — modalità SHADOW-first: finché il flag non dice "on" i piani serviti
 * NON cambiano, il calcolo viene solo registrato in provenance per il QA.
 *
 * GATING (env, letto dal chiamante via `resolveDayEngineMode`):
 *   NUTRITION_DAY_ENGINE_MODE = "off" | "shadow" | "on" — DEFAULT nel codice: "shadow"
 *     (calcola e registra, serve il vecchio — zero impatto utente). "off" è il kill switch
 *     globale e vince anche sull'allowlist.
 *   NUTRITION_DAY_ENGINE_ATHLETES = csv di athleteId che forzano "on" quando la modalità
 *     globale è "shadow" (QA su utentetest senza flippare tutti).
 *   Nel bundle Deno della Edge Function `process.env` è lo shim di env-shim.ts: chiavi
 *   assenti → undefined → default "shadow" (comportamento identico alla route Next).
 *
 * RATIO SUL CONSUMO STIMATO, MAI SULL'OSSERVATO (decisione di Mario: il device corregge
 * dopo, non classifica). Qui il modello energia viene ricalcolato SENZA observedActiveKcal:
 *   ratio = (bmrKcal + lifestyleKcal + trainingKcal STIMATO) / bmrKcal
 * con bmr/lifestyle dai campi del modello (`computeNutritionDailyEnergyModel`: Katch-McArdle
 * quando c'è body fat → leanMassKg esposto) e trainingKcal da requirements.energy.trainingKcal
 * (già "modello se >0, altrimenti stima substrati"; requirements non usa mai l'osservato).
 *
 * PONTE FUELING↔PASTI (riconciliazione decisa, in attesa di conferma di Mario):
 * il fueling intra-seduta resta ESATTAMENTE quello attuale (substrati, già in produzione —
 * qui NON viene toccato). Ai pasti va:
 *   CHO_pasti = max(0, CHO_giorno − CHO_fueling_intra_grammi)  [flag se scatta il clamp]
 *   PRO_pasti = PRO_giorno; FAT_pasti = FAT_giorno (il fueling intra è essenzialmente solo CHO).
 * I CHO pre/post seduta NON vengono sottratti: restano dentro i pasti/spuntini.
 *
 * TABELLA §5 (distribuzione slot): Recupero → 3 pasti 35/35/30. Leggero/Pesante → tabella
 * MATTINO se la prima seduta pianificata inizia prima delle 12:00; POMERIGGIO altrimenti
 * O QUANDO L'ORARIO NON È NOTO (default documentato: senza orario si assume pomeriggio,
 * flag "training_time_unknown_default_pomeriggio"). "Non noto" include la routine
 * compilata ma SENZA training1_start_time esplicito: qui non vale il "07:00" sintetizzato
 * dalla coerenza orari pasto (vedi resolveFirstSessionStartMinutes). Ogni slot riceve la sua percentuale
 * applicata A OGNI MACRO dei pasti; le kcal slot derivano dai macro (4,1/4,1/9 di Mario).
 *
 * QUALSIASI dato mancante → applicable=false, MAI throw: il chiamante serve il piano attuale.
 */

import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";
import { parseLocalTimeToMinutes } from "@/lib/nutrition/nutrition-meal-times-training-coherence";
import { profileWeekDayKeyFromIsoLocal } from "@/lib/nutrition/routine-week-plan-meal-times";
import {
  classifyNutritionDay,
  lookupMealDistribution,
  MARIO_KCAL_PER_G,
  type MealDistributionSlot,
  type NutritionDayClass,
} from "@/lib/nutrition/v2/day-classification-engine";

export type NutritionDayEngineMode = "off" | "shadow" | "on";

/**
 * Risolve la modalità day-engine da env + athleteId.
 *
 * DEFAULT "on" (decisione proprietario 8 ago: «ON per tutti, non per utentetest»):
 * il generativo è il comportamento normale della piattaforma, non un esperimento —
 * così vale su TUTTI i percorsi (Edge, route Next, cron headless) senza dipendere
 * dalla configurazione env di due ambienti diversi.
 * - "off" → kill switch per tutti (vince anche sull'allowlist).
 * - "shadow" → calcola e registra in provenance, serve il vecchio: resta disponibile
 *   per diagnosi, ma va chiesta esplicitamente.
 * - "shadow" + athleteId nell'allowlist csv NUTRITION_DAY_ENGINE_ATHLETES → "on" per lui.
 */
export function resolveDayEngineMode(
  env: Record<string, string | undefined>,
  athleteId: string | null | undefined,
): NutritionDayEngineMode {
  const raw = (env.NUTRITION_DAY_ENGINE_MODE ?? "").trim().toLowerCase();
  const globalMode: NutritionDayEngineMode =
    raw === "off" ? "off" : raw === "shadow" ? "shadow" : "on";
  if (globalMode !== "shadow") return globalMode;
  const allow = (env.NUTRITION_DAY_ENGINE_ATHLETES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const id = (athleteId ?? "").trim();
  if (id && allow.includes(id)) return "on";
  return "shadow";
}

/** Colonne tabelle §5 → nomenclatura slot ESISTENTE del composer. */
const DISTRIBUTION_SLOT_TO_MEAL_KEY: Record<MealDistributionSlot, MealSlotKey> = {
  colazione: "breakfast",
  spuntino: "snack_am",
  pranzo: "lunch",
  merenda: "snack_pm",
  cena: "dinner",
  spuntino_serale: "snack_evening",
};

const DISTRIBUTION_SLOT_ORDER: readonly MealDistributionSlot[] = [
  "colazione",
  "spuntino",
  "pranzo",
  "merenda",
  "cena",
  "spuntino_serale",
];

/**
 * Orari default quando il client non ha uno slot omologo con orario proprio.
 * NOTA: `DayEngineSlot.time` vive in provenance/QA — anche in ON gli orari SERVITI
 * restano quelli del flusso mealTimes esistente (orario client se presente, altrimenti
 * DEFAULT_MEAL_TIMES del builder): `dayEngineSlotsToDietBudgets` passa al composer solo
 * i budget macro, nella stessa forma di sempre, senza campo orario.
 */
export const DAY_ENGINE_DEFAULT_SLOT_TIMES: Record<MealSlotKey, string> = {
  breakfast: "07:00",
  snack_am: "10:00",
  lunch: "13:00",
  snack_pm: "16:30",
  dinner: "20:00",
  snack_evening: "22:00",
};

const DEFAULT_SLOT_LABELS: Record<MealSlotKey, string> = {
  breakfast: "Colazione",
  snack_am: "Spuntino",
  lunch: "Pranzo",
  snack_pm: "Merenda",
  dinner: "Cena",
  snack_evening: "Spuntino serale",
};

export type DayEngineSlot = {
  key: MealSlotKey;
  label: string;
  /**
   * HH:mm — dall'omologo slot del client se presente, altrimenti default.
   * Solo provenance/QA: gli orari serviti seguono il flusso mealTimes esistente
   * (vedi nota su DAY_ENGINE_DEFAULT_SLOT_TIMES).
   */
  time: string;
  /** % della tabella §5 (applicata a ogni macro dei pasti). */
  pct: number;
  kcal: number;
  choG: number;
  proteinG: number;
  fatG: number;
};

export type DayEngineDayResult = {
  mode: "shadow" | "on";
  applicable: boolean;
  /** Presente solo quando applicable=false (es. lean_mass_missing). */
  reason?: string;
  dayClass?: NutritionDayClass;
  ratio?: number;
  strategiaPct: number;
  bmrKcal?: number;
  leanMassKg?: number;
  /** Consumo STIMATO del giorno: bmr + lifestyle + training stimato. */
  consumoKcal?: number;
  kcalTarget?: number;
  quotas?: { proteinGPerKgLean: number; fatGPerKgLean: number };
  dayTotals?: { proteinG: number; fatG: number; choG: number; choDeficit: boolean };
  /** Grammi CHO intra-seduta pianificati dal fueling substrati (0 se nessuna seduta). */
  fuelingChoG: number;
  mealTotals?: { choG: number; proteinG: number; fatG: number; kcal: number };
  table?: "recupero" | "mattino" | "pomeriggio";
  slots: DayEngineSlot[];
  flags: string[];
};

export type DayEngineComputeInput = {
  mode: "shadow" | "on";
  requirements: DailyNutritionRequirementsV2;
  request: IntelligentMealPlanRequest;
  /** Da Profile Diet: % calorie rispetto fabbisogno del giorno (assente → 100). */
  dietDay?: { dayTypePct?: number | null } | null;
  weightKg: number;
  /** Necessario per massa magra/Katch: senza, il day-engine è "non applicabile". */
  bodyFatPct?: number | string | null;
  lifestyleActivityClass?: string | null;
  /** Minuti da mezzanotte dell'inizio prima seduta; null/undefined = ignoto → POMERIGGIO. */
  firstSessionStartMinutes?: number | null;
};

function coerceFinite(v: number | string | null | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function kcalFromMacros(choG: number, proG: number, fatG: number): number {
  return Math.round(choG * MARIO_KCAL_PER_G.cho + proG * MARIO_KCAL_PER_G.pro + fatG * MARIO_KCAL_PER_G.fat);
}

function nonEmptyTime(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Inizio prima seduta pianificata (minuti da mezzanotte) dalla routine dell'atleta —
 * SOLO da un `training1_start_time` ESPLICITO (`routine_config.week_plan[wd]`, fallback
 * root). ⚠️ Volutamente NON usa `inferTrainingStartMinutesFromRoutine` (coerenza orari
 * pasto): quella sintetizza "07:00" quando la seduta esiste ma l'orario manca, e qui
 * un orario inventato sceglierebbe la tabella MATTINO. Per il day-engine "orario non
 * noto" (routine assente, giorno senza voce, o seduta senza orario esplicito) = null →
 * il chiamante applica il default POMERIGGIO + flag training_time_unknown_default_pomeriggio.
 */
export function resolveFirstSessionStartMinutes(args: {
  routineConfig?: Record<string, unknown> | null;
  planDate: string;
  plannedDurationsMin: number[];
}): number | null {
  const rc = args.routineConfig;
  if (!rc || typeof rc !== "object" || Array.isArray(rc)) return null;
  const root = rc as Record<string, unknown>;
  const weekPlanRaw = root.week_plan;
  const weekPlan =
    weekPlanRaw && typeof weekPlanRaw === "object" && !Array.isArray(weekPlanRaw)
      ? (weekPlanRaw as Record<string, unknown>)
      : {};
  const dayRaw = weekPlan[profileWeekDayKeyFromIsoLocal(args.planDate)];
  const day =
    dayRaw && typeof dayRaw === "object" && !Array.isArray(dayRaw)
      ? (dayRaw as Record<string, unknown>)
      : {};

  // C'è davvero una seduta quel giorno? (stessa soglia della coerenza orari: Σ ≥25 min
  // pianificati oppure flag has_training in routine). Senza seduta non esiste "prima seduta".
  const sumPlanned = args.plannedDurationsMin.reduce(
    (s, n) => s + (Number.isFinite(n) && n > 0 ? n : 0),
    0,
  );
  const hr = day.has_training;
  const hasTraining =
    sumPlanned >= 25 || hr === true || hr === 1 || String(hr).toLowerCase() === "true" || String(hr) === "1";
  if (!hasTraining) return null;

  const explicit = nonEmptyTime(day.training1_start_time) ?? nonEmptyTime(root.training1_start_time);
  if (!explicit) return null;
  return parseLocalTimeToMinutes(explicit);
}

function pickStrategiaPct(dayTypePct: number | null | undefined): number {
  return typeof dayTypePct === "number" && Number.isFinite(dayTypePct) && dayTypePct > 0
    ? dayTypePct
    : 100;
}

function intraFuelingChoG(requirements: DailyNutritionRequirementsV2): number {
  const g = requirements.substrateFueling?.totals.intraChoG;
  return typeof g === "number" && Number.isFinite(g) && g > 0 ? round1(g) : 0;
}

/**
 * Calcolo completo del giorno secondo il modello di Mario. PURO: non muta né `request`
 * né `requirements`. Mai throw per dati mancanti → applicable=false.
 */
export function computeDayEngineDay(input: DayEngineComputeInput): DayEngineDayResult {
  const flags: string[] = [];
  const strategiaPct = pickStrategiaPct(input.dietDay?.dayTypePct);
  const fuelingChoG = intraFuelingChoG(input.requirements);

  // Modello energia ricalcolato QUI, SENZA observedActiveKcal: il ratio classifica sul
  // consumo stimato (il device corregge dopo, non classifica). Katch-McArdle quando c'è
  // il body fat → bmrKcal ancorato alla massa magra e leanMassKg esposto dal modello.
  const model = computeNutritionDailyEnergyModel({
    athleteId: input.request.athleteId,
    date: input.request.planDate,
    weightKg: input.weightKg,
    bodyFatPct: coerceFinite(input.bodyFatPct),
    lifestyleActivityClass: input.lifestyleActivityClass ?? "moderate",
    plannedTraining: [],
  });

  // Training STIMATO dal fabbisogno V2 (modello se >0, altrimenti substrati) — requirements
  // è costruito senza dato device, quindi è sempre la stima.
  const trainingKcalRaw = input.requirements.energy.trainingKcal;
  const trainingKcal =
    typeof trainingKcalRaw === "number" && Number.isFinite(trainingKcalRaw) && trainingKcalRaw > 0
      ? trainingKcalRaw
      : 0;
  const consumoKcal = model.bmrKcal + model.lifestyle.kcal + trainingKcal;

  const cls = classifyNutritionDay({
    bmrKcal: model.bmrKcal,
    leanMassKg: model.leanMassKg,
    consumoKcal,
    strategiaPct,
  });
  if (!cls) {
    return {
      mode: input.mode,
      applicable: false,
      reason: model.leanMassKg == null || model.leanMassKg <= 0 ? "lean_mass_missing" : "classification_null",
      strategiaPct,
      fuelingChoG,
      slots: [],
      flags,
    };
  }
  if (cls.choDeficit) flags.push("cho_deficit");

  // Confine fueling/pasti (PONTE, vedi header): dal giorno si sottrae SOLO il CHO intra.
  const choMealsRaw = cls.choG - fuelingChoG;
  const fuelingClamped = choMealsRaw < 0;
  if (fuelingClamped) flags.push("fueling_cho_exceeds_day_cho_clamped_0");
  const mealChoG = fuelingClamped ? 0 : round1(choMealsRaw);
  const mealProteinG = cls.proteinG;
  const mealFatG = cls.fatG;

  // Tabella §5: recupero unica; leggero/pesante per orario prima seduta (default POMERIGGIO).
  let table: "recupero" | "mattino" | "pomeriggio";
  if (cls.dayClass === "recupero") {
    table = "recupero";
  } else if (input.firstSessionStartMinutes == null) {
    table = "pomeriggio";
    flags.push("training_time_unknown_default_pomeriggio");
  } else {
    table = input.firstSessionStartMinutes < 12 * 60 ? "mattino" : "pomeriggio";
  }
  const distribution = lookupMealDistribution(
    cls.dayClass,
    table === "mattino" ? "mattino" : "pomeriggio",
  );

  const clientSlotByKey = new Map(input.request.slots.map((s) => [s.slot, s]));
  const slots: DayEngineSlot[] = [];
  for (const distKey of DISTRIBUTION_SLOT_ORDER) {
    const pct = distribution[distKey];
    if (pct == null || pct <= 0) continue;
    const key = DISTRIBUTION_SLOT_TO_MEAL_KEY[distKey];
    const choG = round1((mealChoG * pct) / 100);
    const proteinG = round1((mealProteinG * pct) / 100);
    const fatG = round1((mealFatG * pct) / 100);
    const client = clientSlotByKey.get(key);
    const clientTime = client?.scheduledTimeLocal?.trim();
    slots.push({
      key,
      label: client?.labelIt?.trim() || DEFAULT_SLOT_LABELS[key],
      time: clientTime || DAY_ENGINE_DEFAULT_SLOT_TIMES[key],
      pct,
      kcal: kcalFromMacros(choG, proteinG, fatG),
      choG,
      proteinG,
      fatG,
    });
  }

  return {
    mode: input.mode,
    applicable: true,
    dayClass: cls.dayClass,
    ratio: cls.ratio,
    strategiaPct: cls.strategiaPct,
    bmrKcal: model.bmrKcal,
    leanMassKg: model.leanMassKg ?? undefined,
    consumoKcal: Math.round(consumoKcal),
    kcalTarget: cls.kcalTarget,
    quotas: { proteinGPerKgLean: cls.proteinGPerKgLean, fatGPerKgLean: cls.fatGPerKgLean },
    dayTotals: { proteinG: cls.proteinG, fatG: cls.fatG, choG: cls.choG, choDeficit: cls.choDeficit },
    fuelingChoG,
    mealTotals: {
      choG: mealChoG,
      proteinG: mealProteinG,
      fatG: mealFatG,
      kcal: kcalFromMacros(mealChoG, mealProteinG, mealFatG),
    },
    table,
    slots,
    flags,
  };
}

/** Slot budget nella forma ESATTA che il composer riceve da sempre. */
export function dayEngineSlotsToDietBudgets(slots: DayEngineSlot[]): MealPlanV2DietSlotBudget[] {
  return slots.map((s) => ({
    key: s.key,
    label: s.label,
    pct: s.pct,
    kcal: s.kcal,
    carbs: s.choG,
    protein: s.proteinG,
    fat: s.fatG,
  }));
}

type ProvenanceMacroTuple = { kcal: number; choG: number; proG: number; fatG: number };

export type DayEngineProvenanceSlot = {
  key: string;
  /** Slot attuale (quello che il composer riceve in shadow / riceveva prima). */
  before: ProvenanceMacroTuple | null;
  /** Slot proposto dal day-engine. */
  after: ProvenanceMacroTuple | null;
  deltaKcal: number;
  deltaChoG: number;
  deltaProG: number;
  deltaFatG: number;
};

/** Confronto COMPATTO persistito in nutrition_plan.inputs_provenance.day_engine (canale QA). */
export type DayEngineProvenance = {
  engine: "day_classification_v1";
  mode: "shadow" | "on";
  /** true SOLO quando gli slot passati al composer sono quelli del day-engine. */
  applied: boolean;
  applicable: boolean;
  reason?: string;
  dayClass?: NutritionDayClass;
  ratio?: number;
  strategiaPct: number;
  bmrKcal?: number;
  leanMassKg?: number;
  consumoKcal?: number;
  kcalTarget?: number;
  quotas?: { proteinGPerKgLean: number; fatGPerKgLean: number };
  dayTotals?: { proteinG: number; fatG: number; choG: number; choDeficit: boolean };
  fuelingChoG: number;
  mealTotals?: { choG: number; proteinG: number; fatG: number; kcal: number };
  table?: "recupero" | "mattino" | "pomeriggio";
  flags: string[];
  slots: DayEngineProvenanceSlot[];
};

function budgetTuple(b: MealPlanV2DietSlotBudget): ProvenanceMacroTuple {
  return {
    kcal: Math.round(b.kcal),
    choG: round1(b.carbs),
    proG: round1(b.protein),
    fatG: round1(b.fat),
  };
}

function slotTuple(s: DayEngineSlot): ProvenanceMacroTuple {
  return { kcal: s.kcal, choG: s.choG, proG: s.proteinG, fatG: s.fatG };
}

/**
 * Costruisce il report compatto vecchio-vs-nuovo per provenance/QA:
 * per ogni slot (unione chiavi, ordine giornata) kcal/CHO/PRO/FAT attuali vs day-engine + delta.
 */
export function buildDayEngineProvenance(
  result: DayEngineDayResult,
  currentSlots: MealPlanV2DietSlotBudget[],
  applied: boolean,
): DayEngineProvenance {
  const order: string[] = ["breakfast", "snack_am", "lunch", "snack_pm", "dinner", "snack_evening"];
  const beforeByKey = new Map(currentSlots.map((b) => [String(b.key), budgetTuple(b)]));
  const afterByKey = new Map(result.slots.map((s) => [String(s.key), slotTuple(s)]));
  const keys = [
    ...order.filter((k) => beforeByKey.has(k) || afterByKey.has(k)),
    ...[...beforeByKey.keys()].filter((k) => !order.includes(k)),
  ];
  const slots: DayEngineProvenanceSlot[] = keys.map((key) => {
    const before = beforeByKey.get(key) ?? null;
    const after = afterByKey.get(key) ?? null;
    return {
      key,
      before,
      after,
      deltaKcal: Math.round((after?.kcal ?? 0) - (before?.kcal ?? 0)),
      deltaChoG: round1((after?.choG ?? 0) - (before?.choG ?? 0)),
      deltaProG: round1((after?.proG ?? 0) - (before?.proG ?? 0)),
      deltaFatG: round1((after?.fatG ?? 0) - (before?.fatG ?? 0)),
    };
  });
  return {
    engine: "day_classification_v1",
    mode: result.mode,
    applied,
    applicable: result.applicable,
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.dayClass ? { dayClass: result.dayClass } : {}),
    ...(result.ratio != null ? { ratio: Math.round(result.ratio * 1000) / 1000 } : {}),
    strategiaPct: result.strategiaPct,
    ...(result.bmrKcal != null ? { bmrKcal: result.bmrKcal } : {}),
    ...(result.leanMassKg != null ? { leanMassKg: result.leanMassKg } : {}),
    ...(result.consumoKcal != null ? { consumoKcal: result.consumoKcal } : {}),
    ...(result.kcalTarget != null ? { kcalTarget: result.kcalTarget } : {}),
    ...(result.quotas ? { quotas: result.quotas } : {}),
    ...(result.dayTotals ? { dayTotals: result.dayTotals } : {}),
    fuelingChoG: result.fuelingChoG,
    ...(result.mealTotals ? { mealTotals: result.mealTotals } : {}),
    ...(result.table ? { table: result.table } : {}),
    flags: [...result.flags],
    slots,
  };
}
