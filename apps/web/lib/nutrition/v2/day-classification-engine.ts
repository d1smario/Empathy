/**
 * Motore classi/quote giornaliere di Mario — mattone "taratura" del generativo Nutrition.
 *
 * MODULO PURO E NON COLLEGATO: zero import (nemmeno tipi condivisi), nessun client,
 * nessun consumer. Il collegamento al resto del sistema è il mattone successivo
 * (void requirements): NON importarlo da altri moduli finché quel mattone non esiste.
 *
 * Regole DECISE E BLOCCATE (Mario, 6 ago 2026) — non "migliorarle":
 *
 * 1. RATIO = consumoKcal / bmrKcal (BMR Katch-McArdle su massa magra).
 *    Il ratio si calcola sul CONSUMO stimato del giorno, non sul target scalato:
 *    strategiaPct (100 normo; 105|110 iper; 95|90 ipo) moltiplica il consumo per
 *    ottenere il target kcal, ma NON sposta la classe né le quote g/kg.
 *
 * 2. CLASSI a confini CONTIGUI, interpolazione LINEARE dentro la banda:
 *      Recupero: ratio < 1.55 — banda 1.00→1.55; PRO 1.2→1.8, FAT 1.2→1.8 g/kg magra;
 *                sotto 1.00 clamp al minimo.
 *      Leggero:  1.55 ≤ ratio < 2.15 — PRO 1.8→2.4, FAT 1.3→2.0.
 *      Pesante:  ratio ≥ 2.15 — banda 2.15→4.00 (TETTO 4, deciso); PRO 2.5→4.0,
 *                FAT 1.8→3.0; sopra 4.00 CLAMP al massimo, MAI estrapolare.
 *
 *    NOTA sugli ancoraggi verbali di Mario ("a 1,6 proteine 1,8; a 2,1 proteine 2,4"):
 *    erano riferiti alla sua banda originale 1,6–2,1. Coi confini contigui decisi dopo
 *    (1,55–2,15) gli estremi della banda portano il min e il max, quindi a ratio 1,60
 *    esce PRO 1,85 e non 1,80. È la conseguenza aritmetica della SUA decisione sui
 *    confini, non una licenza nostra.
 *
 *    Il DENTE DI SEGA dei grassi ai confini (Recupero→Leggero: 1,8→1,3; Leggero→Pesante:
 *    2,0→1,8) è VOLUTO (alternanza ormonale): non smussarlo. Anche il gradino delle
 *    proteine 2,4→2,5 a ratio 2,15 è da tabella.
 *
 * 3. QUOTE in g per kg di MASSA MAGRA. Fattori kcal di Mario: PRO 4.1, CHO 4.1,
 *    FAT 9.0 kcal/g — DIVERGONO volutamente dal 4/4/9 usato altrove nel codice
 *    (es. canonical-food-composition, fueling): qui si usano i suoi.
 *
 * 4. CHO = (kcalTarget − kcalPro − kcalFat) / 4.1. Se negativo → 0 g + choDeficit=true
 *    (in regime standard non deve succedere: il test a griglia lo dimostra).
 *
 * 5. PASTI per classe: Recupero 3, Leggero 4–5, Pesante 5–6.
 *
 * 6. Input mancanti/non validi (leanMassKg o bmrKcal ≤ 0 o non finiti) → null,
 *    MAI throw: il chiamante futuro farà fallback.
 *
 * 7. Tabelle di distribuzione kcal per pasto (documento §5) esportate come costanti
 *    + lookup puro, NON collegate a nessun compositore.
 */

export type NutritionDayClass = "recupero" | "leggero" | "pesante";

export type DayClassificationInput = {
  /** BMR Katch-McArdle del giorno (kcal). ≤0/non finito → risultato null. */
  bmrKcal: number | null | undefined;
  /** Massa magra (kg). ≤0/non finita → risultato null. */
  leanMassKg: number | null | undefined;
  /** Energia totale stimata del giorno (kcal): BMR + lifestyle + training. */
  consumoKcal: number | null | undefined;
  /** 100 normo; 105|110 iper; 95|90 ipo. Moltiplica il consumo → target kcal. Default 100. */
  strategiaPct?: number | null;
};

export type DayClassificationResult = {
  /** consumoKcal / bmrKcal (NON clampato: il clamp agisce solo sulle quote via t). */
  ratio: number;
  dayClass: NutritionDayClass;
  /** Posizione nella banda della classe, 0..1 (già clampata: è la t dell'interpolazione). */
  t: number;
  /** consumoKcal × strategiaPct/100, arrotondato. */
  kcalTarget: number;
  strategiaPct: number;
  /** Quote usate, g per kg di massa magra — servono alla provenance. */
  proteinGPerKgLean: number;
  fatGPerKgLean: number;
  /** Grammi assoluti (quota × massa magra), 1 decimale. */
  proteinG: number;
  fatG: number;
  /** Grammi CHO dal residuo kcal (fattore 4.1), 1 decimale; 0 se il residuo è negativo. */
  choG: number;
  /** true se il residuo CHO era negativo (kcalTarget insufficiente per PRO+FAT). */
  choDeficit: boolean;
  /** Pasti per classe: Recupero [3,3], Leggero [4,5], Pesante [5,6]. */
  mealCountRange: [number, number];
};

/** Fattori kcal/g di Mario — PRO/CHO 4.1 e FAT 9.0, NON il 4/4/9 usato altrove. */
export const MARIO_KCAL_PER_G = {
  pro: 4.1,
  cho: 4.1,
  fat: 9.0,
} as const;

type BandSpec = {
  dayClass: NutritionDayClass;
  /** Estremi della banda di interpolazione del ratio. */
  ratioMin: number;
  ratioMax: number;
  proMin: number;
  proMax: number;
  fatMin: number;
  fatMax: number;
  mealCountRange: [number, number];
};

/** Bande di Mario (confini contigui 1.55 / 2.15, tetto 4.00). Esportate per la provenance. */
export const DAY_CLASS_BANDS: readonly BandSpec[] = [
  {
    dayClass: "recupero",
    ratioMin: 1.0,
    ratioMax: 1.55,
    proMin: 1.2,
    proMax: 1.8,
    fatMin: 1.2,
    fatMax: 1.8,
    mealCountRange: [3, 3],
  },
  {
    dayClass: "leggero",
    ratioMin: 1.55,
    ratioMax: 2.15,
    proMin: 1.8,
    proMax: 2.4,
    fatMin: 1.3,
    fatMax: 2.0,
    mealCountRange: [4, 5],
  },
  {
    dayClass: "pesante",
    ratioMin: 2.15,
    ratioMax: 4.0,
    proMin: 2.5,
    proMax: 4.0,
    fatMin: 1.8,
    fatMax: 3.0,
    mealCountRange: [5, 6],
  },
] as const;

/** Slot pasto delle tabelle di distribuzione §5. */
export type MealDistributionSlot =
  | "colazione"
  | "spuntino"
  | "pranzo"
  | "merenda"
  | "cena"
  | "spuntino_serale";

export type MealDistribution = Readonly<Partial<Record<MealDistributionSlot, number>>>;

/** Giorno di recupero: 3 pasti, 35/35/30 (colazione/pranzo/cena). */
export const MEAL_DISTRIBUTION_RECUPERO: MealDistribution = {
  colazione: 35,
  pranzo: 35,
  cena: 30,
} as const;

/** Allenamento al MATTINO (colazione/spuntino/pranzo/merenda/cena/spuntino serale). */
export const MEAL_DISTRIBUTION_TRAINING_MATTINO: Readonly<
  Record<"leggero" | "pesante", MealDistribution>
> = {
  leggero: { colazione: 25, spuntino: 12, pranzo: 30, merenda: 13, cena: 20, spuntino_serale: 0 },
  pesante: { colazione: 27, spuntino: 12, pranzo: 25, merenda: 10, cena: 20, spuntino_serale: 6 },
} as const;

/** Allenamento al POMERIGGIO (colazione/spuntino/pranzo/merenda/cena/spuntino serale). */
export const MEAL_DISTRIBUTION_TRAINING_POMERIGGIO: Readonly<
  Record<"leggero" | "pesante", MealDistribution>
> = {
  leggero: { colazione: 20, spuntino: 12, pranzo: 35, merenda: 13, cena: 20, spuntino_serale: 0 },
  pesante: { colazione: 22, spuntino: 12, pranzo: 30, merenda: 10, cena: 20, spuntino_serale: 6 },
} as const;

/**
 * Lookup puro della tabella §5 (NON collegato a nessun compositore).
 * Il giorno di recupero ha un'unica tabella, indipendente dall'orario di allenamento.
 */
export function lookupMealDistribution(
  dayClass: NutritionDayClass,
  trainingTime: "mattino" | "pomeriggio",
): MealDistribution {
  if (dayClass === "recupero") return MEAL_DISTRIBUTION_RECUPERO;
  const table =
    trainingTime === "mattino"
      ? MEAL_DISTRIBUTION_TRAINING_MATTINO
      : MEAL_DISTRIBUTION_TRAINING_POMERIGGIO;
  return table[dayClass];
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pickBand(ratio: number): BandSpec {
  if (ratio < 1.55) return DAY_CLASS_BANDS[0];
  if (ratio < 2.15) return DAY_CLASS_BANDS[1];
  return DAY_CLASS_BANDS[2];
}

/**
 * Classifica il giorno e deriva le quote macro di Mario.
 * Ritorna null (mai throw) se bmrKcal/leanMassKg mancano o non sono > 0,
 * o se consumoKcal non è un numero finito ≥ 0.
 */
export function classifyNutritionDay(
  input: DayClassificationInput,
): DayClassificationResult | null {
  if (!isPositiveFinite(input.bmrKcal) || !isPositiveFinite(input.leanMassKg)) return null;
  const consumoKcal = input.consumoKcal;
  if (typeof consumoKcal !== "number" || !Number.isFinite(consumoKcal) || consumoKcal < 0) {
    return null;
  }
  const strategiaPct = isPositiveFinite(input.strategiaPct ?? null)
    ? (input.strategiaPct as number)
    : 100;

  const bmrKcal = input.bmrKcal;
  const leanMassKg = input.leanMassKg;
  const ratio = consumoKcal / bmrKcal;
  const band = pickBand(ratio);
  // t clampata 0..1: sotto 1.00 → minimo Recupero; sopra 4.00 → massimo Pesante (mai estrapolare).
  const t = clamp01((ratio - band.ratioMin) / (band.ratioMax - band.ratioMin));

  const proteinGPerKgLean = band.proMin + t * (band.proMax - band.proMin);
  const fatGPerKgLean = band.fatMin + t * (band.fatMax - band.fatMin);
  const proteinG = round1(proteinGPerKgLean * leanMassKg);
  const fatG = round1(fatGPerKgLean * leanMassKg);

  const kcalTarget = Math.round(consumoKcal * (strategiaPct / 100));
  const choKcalResidual =
    kcalTarget - proteinG * MARIO_KCAL_PER_G.pro - fatG * MARIO_KCAL_PER_G.fat;
  const choDeficit = choKcalResidual < 0;
  const choG = choDeficit ? 0 : round1(choKcalResidual / MARIO_KCAL_PER_G.cho);

  return {
    ratio,
    dayClass: band.dayClass,
    t,
    kcalTarget,
    strategiaPct,
    proteinGPerKgLean,
    fatGPerKgLean,
    proteinG,
    fatG,
    choG,
    choDeficit,
    mealCountRange: [band.mealCountRange[0], band.mealCountRange[1]],
  };
}
