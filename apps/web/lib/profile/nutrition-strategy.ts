/**
 * STRATEGIA NUTRIZIONALE — mappatura pura fra la scelta del coach e `day_type_pct`.
 *
 * MODELLO: l'atleta dichiara solo la sua routine (orari) e cosa non mangia; il coach
 * dichiara UNA sola cosa — la fase calorica: ipocalorico | normocalorico | ipercalorico
 * (con intensità 5% o 10% quando non è normo). Tutto il resto — numero pasti, quote
 * PRO/FAT per kg di massa magra, carboidrati residui, distribuzione sui pasti — lo
 * decide il generativo ogni giorno dal consumo reale.
 *
 * FORMA DATI INVARIATA: la strategia si scrive come `day_type_pct` in
 * `athlete_profiles.nutrition_config.week_plan[Mon…Sun]` — la stessa leva che
 * `resolve-nutrition-diet-day` legge e che `daily-energy-solver` usa come `dietScale`.
 * Zero migrazioni: cambia solo CHI la scrive e con quale UI.
 *
 * Scala (documento Mario): ipocalorica 95 / 90, normocalorica 100, ipercalorica 105 / 110.
 *
 * Modulo PURO e senza dipendenze (testabile con `tsx --test`): nessun import da
 * `lib/nutrition`, nessun server-only.
 */

export type NutritionStrategyKind = "hypocaloric" | "normocaloric" | "hypercaloric";

/** Scarto dal 100% consentito dal modello: solo 5% o 10%. */
export type NutritionStrategyIntensityPct = 5 | 10;

export const NUTRITION_STRATEGY_INTENSITIES: readonly NutritionStrategyIntensityPct[] = [5, 10];

export type NutritionStrategy = {
  kind: NutritionStrategyKind;
  /** `null` SOLO per `normocaloric` (100% = nessuno scarto): rende il round-trip esatto. */
  intensityPct: NutritionStrategyIntensityPct | null;
};

/** 100% del fabbisogno = nessuna scalatura (valore di TUTTE le righe in produzione). */
export const NORMOCALORIC_DAY_TYPE_PCT = 100;

export const NORMOCALORIC_STRATEGY: NutritionStrategy = { kind: "normocaloric", intensityPct: null };

/** Le sole 5 combinazioni ammesse dal modello, in ordine crescente di percentuale. */
const CANONICAL_STRATEGIES: readonly NutritionStrategy[] = [
  { kind: "hypocaloric", intensityPct: 10 },
  { kind: "hypocaloric", intensityPct: 5 },
  NORMOCALORIC_STRATEGY,
  { kind: "hypercaloric", intensityPct: 5 },
  { kind: "hypercaloric", intensityPct: 10 },
];

/**
 * Numero finito da JSONB: solo `number` o stringa numerica NON vuota.
 * `null`/`""`/`[]` NON diventano 0 (la coercizione di `Number()` li snapperebbe a 90%,
 * cioè a un deficit mai scelto da nessuno): sono "non configurato" → normocalorico.
 */
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Strategia → `day_type_pct`. Intensità mancante/anomala su ipo|iper → 5% (scarto minimo). */
export function strategyToDayTypePct(strategy: NutritionStrategy): number {
  const intensity: NutritionStrategyIntensityPct = strategy.intensityPct === 10 ? 10 : 5;
  switch (strategy.kind) {
    case "hypocaloric":
      return NORMOCALORIC_DAY_TYPE_PCT - intensity;
    case "hypercaloric":
      return NORMOCALORIC_DAY_TYPE_PCT + intensity;
    default:
      return NORMOCALORIC_DAY_TYPE_PCT;
  }
}

/**
 * `day_type_pct` → strategia, agganciandosi alla combinazione canonica più vicina.
 *
 * Le percentuali fuori scala esistono solo nei preset legacy (`fasting-0`, `severe-15-30`,
 * `catabolic-50-99`, `anabolic-101-130`), che in produzione NON sono mai stati usati:
 * tutte le righe valgono 100. Snap al valore canonico più vicino (parità → il più basso,
 * cioè il più prudente) invece di un'eccezione: la UI deve sempre poter mostrare una
 * delle tre scelte. Valore non numerico → normocalorico.
 */
export function dayTypePctToStrategy(pct: unknown): NutritionStrategy {
  const value = toFiniteNumber(pct);
  if (value == null) return NORMOCALORIC_STRATEGY;
  let best = NORMOCALORIC_STRATEGY;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const candidate of CANONICAL_STRATEGIES) {
    const delta = Math.abs(strategyToDayTypePct(candidate) - value);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

/**
 * Strategia della SETTIMANA a partire dai `day_type_pct` dei sette giorni.
 * La strategia è una scelta di fase (stessa su tutti i giorni), ma il dato resta
 * per-giorno: se una settimana legacy è disomogenea vince la percentuale più
 * frequente (a parità, la prima incontrata). Lista vuota → normocalorico.
 */
export function resolveWeekStrategy(dayPcts: readonly unknown[]): NutritionStrategy {
  const counts = new Map<number, number>();
  const order: number[] = [];
  for (const raw of dayPcts) {
    const pct = strategyToDayTypePct(dayTypePctToStrategy(raw));
    if (!counts.has(pct)) order.push(pct);
    counts.set(pct, (counts.get(pct) ?? 0) + 1);
  }
  if (order.length === 0) return NORMOCALORIC_STRATEGY;
  let bestPct = order[0];
  let bestCount = -1;
  for (const pct of order) {
    const count = counts.get(pct) ?? 0;
    if (count > bestCount) {
      bestPct = pct;
      bestCount = count;
    }
  }
  return dayTypePctToStrategy(bestPct);
}

/**
 * Preset testuale `day_type` coerente con la strategia. Il campo è INERTE (nessun
 * consumatore lo usa per calcolare: `resolve-nutrition-diet-day` lo rilegge e basta),
 * ma viene tenuto allineato alla percentuale per non lasciare in DB un'etichetta
 * "normocaloric-100" accanto a un `day_type_pct` di 90.
 */
export type NutritionStrategyDayTypePreset = "catabolic-50-99" | "normocaloric-100" | "anabolic-101-130";

export function strategyToDayTypePreset(strategy: NutritionStrategy): NutritionStrategyDayTypePreset {
  switch (strategy.kind) {
    case "hypocaloric":
      return "catabolic-50-99";
    case "hypercaloric":
      return "anabolic-101-130";
    default:
      return "normocaloric-100";
  }
}
