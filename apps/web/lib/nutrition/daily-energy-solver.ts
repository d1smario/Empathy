import type {
  LifestyleActivityClass,
  NutritionBmrMethod,
  NutritionDailyEnergyModel,
} from "@/lib/empathy/schemas";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";

type PlannedTrainingEnergyInput = {
  durationMinutes?: number | null;
  kcalTarget?: number | null;
  tssTarget?: number | null;
  avgPowerW?: number | null;
};

type NutritionDailyEnergySolverInput = {
  athleteId: string;
  date: string;
  birthDate?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  ftpWatts?: number | null;
  vo2maxMlMinKg?: number | null;
  lifestyleActivityClass?: LifestyleActivityClass | string | null;
  plannedTraining?: PlannedTrainingEnergyInput[];
  /** Decisione B: kcal ATTIVE osservate dal device per il giorno (sopra il BMR: training + NEAT).
   *  Quando presente, il fabbisogno segue il CONSUMO REALE (BMR + attive) invece della stima
   *  (BMR + lifestyle + training pianificato). Null → si usa la stima (fallback). */
  observedActiveKcal?: number | null;
  recoveryStatus?: "good" | "moderate" | "poor" | "unknown" | null;
  recoverySleepHours?: number | null;
  recoveryHrvMs?: number | null;
  recoveryStrainScore?: number | null;
  /** When set, scales training-derived energy, meal/fueling split, and intra CHO/h deterministically. */
  performanceIntegration?: NutritionPerformanceIntegrationDials | null;
  /** Profile Diet → % calorie rispetto fabbisogno per il giorno (es. 100 normo, 80 deficit). */
  dietDayMealsScalePct?: number | null;
};

const LIFESTYLE_PCT: Record<LifestyleActivityClass, number> = {
  sedentary: 0.15,
  moderate: 0.2,
  active: 0.3,
  very_active: 0.4,
};

/* ────────────────────────────────────────────────────────────────────────────
 * CONFINE FUELING ↔ PASTI — regola di Mario, confermata per iscritto l'8 ago 2026:
 *   «fueling integra il 50% del consumo del training e un altro 40% è distribuito
 *    nei pasti. Il 10% che manca è la quota dedicata al pre e post workout.»
 * Quindi, sull'energia del training pianificato: 40% pasti, 50% intra, 10% pre+post. È il
 * BASELINE (recupero buono, quota pasti 40%): il tier di recupero e l'integrazione
 * performance lo modulano, vedi sotto.
 * I GRAMMI di CHO intra li decide il consumo (modello a substrati, `fueling-from-substrates`):
 * queste quote sono la ripartizione ENERGETICA del budget, non un tetto sui grammi.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Quota dell'energia training che va ai PASTI (regola Mario: 40%). */
export const MEAL_TRAINING_FRACTION_DEFAULT = 0.4;
/** Quota dell'energia training gestita ATTORNO alla seduta: 60% = intra + pre/post. */
export const AROUND_TRAINING_TOTAL = 0.6;
/**
 * Dentro la quota pre+post, il POST pesa il DOPPIO del PRE — decisione proprietario 8 ago.
 * Non dividere 1/2 e 1/2. È il rapporto che il vecchio tier good/unknown aveva già (5:10);
 * i vecchi moderate (6:10) e poor (8:12) stavano sotto il 2:1, ora il rapporto è 2:1 in
 * TUTTI i tier per decisione esplicita.
 */
const PRE_SHARE = 1 / 3;
const POST_SHARE = 2 / 3;

/**
 * Quota INTRA per tier di recupero; pre e post derivano (`AROUND_TRAINING_TOTAL − intra`,
 * poi 1/3 e 2/3). Baseline = regola Mario alla lettera sul recupero buono (intra 0.50 →
 * pre+post 0.10). Il recupero peggiore sposta punti dall'intra al pre/post: è una
 * raffinatezza di Empathy che va conservata, qui solo RICENTRATA su Mario.
 *
 * COSA CAMBIA rispetto alla taratura precedente (nessun tier resta fermo):
 *   vecchi valori → nuovi valori (pre / intra / post)
 *     good+unknown  5 / 45 / 10  →  3,33 / 50 / 6,67
 *     moderate      6 / 44 / 10  →  4,00 / 48 / 8,00
 *     poor          8 / 40 / 12  →  5,00 / 45 / 10,00
 * Tutta la banda si alza di ~5 punti di intra: i NUOVI valori del tier "poor" coincidono
 * numericamente con i VECCHI valori del tier good/unknown (il meno protettivo dei tre) —
 * non è un tier "invariato", è il vecchio trattamento del recupero buono diventato il
 * pavimento del recupero peggiore. In kcal, su 1000 kcal di training il tier poor si sposta
 * di (pre −30, intra +50, post −20). Direzione e ampiezza della modulazione restano invece
 * quelle di prima: good→poor sposta 5 punti dall'intra al pre/post (era 0.45→0.40, ora
 * 0.50→0.45).
 */
const INTRA_FRACTION_BY_RECOVERY = {
  good: 0.5,
  moderate: 0.48,
  poor: 0.45,
} as const;

export type FuelingAroundTrainingSplit = { pre: number; intra: number; post: number };

/**
 * Ripartizione della quota attorno alla seduta. Somma SEMPRE `AROUND_TRAINING_TOTAL`
 * per costruzione (pre e post sono il residuo dell'intra), e `post === 2 × pre` in ogni tier.
 *   good     → pre 0.0333 · intra 0.50 · post 0.0667
 *   moderate → pre 0.0400 · intra 0.48 · post 0.0800
 *   poor     → pre 0.0500 · intra 0.45 · post 0.1000
 */
export function fuelingAroundTrainingSplit(
  recoveryStatus?: "good" | "moderate" | "poor" | "unknown" | null,
): FuelingAroundTrainingSplit {
  const intra =
    recoveryStatus === "poor"
      ? INTRA_FRACTION_BY_RECOVERY.poor
      : recoveryStatus === "moderate"
        ? INTRA_FRACTION_BY_RECOVERY.moderate
        : INTRA_FRACTION_BY_RECOVERY.good;
  const prePost = AROUND_TRAINING_TOTAL - intra;
  return { pre: prePost * PRE_SHARE, intra, post: prePost * POST_SHARE };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Coerces finite numbers from JSON/DB (PostgREST numeric columns may arrive as strings). */
function asFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function deriveAgeYears(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function normalizeLifestyleActivityClass(
  value?: LifestyleActivityClass | string | null,
): LifestyleActivityClass {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "sedentary") return "sedentary";
  if (normalized === "moderate") return "moderate";
  if (normalized === "active") return "active";
  if (normalized === "very_active" || normalized === "very active") return "very_active";
  return "moderate";
}

function computeLeanMassKg(input: {
  weightKg?: number | null;
  bodyFatPct?: number | null;
}): number | null {
  const weightKg = asFinite(input.weightKg);
  const bodyFatPct = asFinite(input.bodyFatPct);
  if (weightKg == null || bodyFatPct == null) return null;
  return round(weightKg * (1 - clamp(bodyFatPct, 0, 70) / 100), 1);
}

function computeMifflinStJeor(input: {
  sex?: string | null;
  ageYears?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
}): number | null {
  const ageYears = asFinite(input.ageYears);
  const heightCm = asFinite(input.heightCm);
  const weightKg = asFinite(input.weightKg);
  if (ageYears == null || heightCm == null || weightKg == null) return null;
  const sex = String(input.sex ?? "").toLowerCase();
  const sexOffset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset;
}

function computeWeightProxyBmr(weightKg?: number | null): number | null {
  const weight = asFinite(weightKg);
  if (weight == null) return null;
  // Conservative fallback only when body-composition or full anthropometry is missing.
  return weight * 22;
}

function deriveAthleteCalibrationPct(input: {
  vo2maxMlMinKg?: number | null;
  ftpWatts?: number | null;
  weightKg?: number | null;
}): number {
  const vo2max = asFinite(input.vo2maxMlMinKg);
  const ftpWatts = asFinite(input.ftpWatts);
  const weightKg = asFinite(input.weightKg);
  const ftpWKg = ftpWatts != null && weightKg != null && weightKg > 0 ? ftpWatts / weightKg : null;
  const vo2Score = vo2max != null ? clamp((vo2max - 45) / 25, 0, 1) : 0;
  const ftpScore = ftpWKg != null ? clamp((ftpWKg - 3.2) / 1.8, 0, 1) : 0;
  return round(clamp(vo2Score * 0.03 + ftpScore * 0.02, 0, 0.05), 3);
}

function deriveBmr(input: NutritionDailyEnergySolverInput): {
  bmrKcal: number;
  bmrMethod: NutritionBmrMethod;
  leanMassKg: number | null;
  ageYears: number | null;
  ftpWKg: number | null;
  notes: string[];
} {
  const notes: string[] = [];
  const ageYears = deriveAgeYears(input.birthDate);
  const weightKg = asFinite(input.weightKg);
  const leanMassKg = computeLeanMassKg({
    weightKg,
    bodyFatPct: input.bodyFatPct,
  });
  const ftpWKg =
    input.ftpWatts != null && weightKg != null && weightKg > 0
      ? round(input.ftpWatts / weightKg, 2)
      : null;

  if (leanMassKg != null) {
    // Decisione Mario (6 ago 2026): Katch-McArdle sostituisce Cunningham. Su 62 kg di
    // massa magra: 1864 → 1709 kcal (−8,3%). Tutte le soglie del suo modello (classi
    // giorno, quote) sono tarate su QUESTO BMR: non ripristinare Cunningham.
    notes.push("BMR anchored to Katch-McArdle using fat-free mass.");
    return {
      bmrKcal: round(370 + 21.6 * leanMassKg),
      bmrMethod: "katch_mcardle_ffm",
      leanMassKg,
      ageYears,
      ftpWKg,
      notes,
    };
  }

  const mifflin = computeMifflinStJeor({
    sex: input.sex,
    ageYears,
    heightCm: input.heightCm,
    weightKg,
  });
  if (mifflin != null) {
    const athleteCalibrationPct = deriveAthleteCalibrationPct(input);
    if (athleteCalibrationPct > 0) {
      notes.push("BMR calibrated upward from Mifflin using athlete aerobic phenotype proxies.");
    } else {
      notes.push("BMR derived from Mifflin-St Jeor fallback due to missing body-fat data.");
    }
    return {
      bmrKcal: round(mifflin * (1 + athleteCalibrationPct)),
      bmrMethod: "mifflin_st_jeor",
      leanMassKg,
      ageYears,
      ftpWKg,
      notes,
    };
  }

  const proxy = computeWeightProxyBmr(weightKg);
  notes.push("BMR derived from weight-only fallback because composition and full anthropometry are incomplete.");
  return {
    bmrKcal: round(proxy ?? 0),
    bmrMethod: "weight_proxy",
    leanMassKg,
    ageYears,
    ftpWKg,
    notes,
  };
}

/** When `planned_workouts.kcal_target` is null and contract kcal cannot be resolved (FTP missing), still budget training from TSS. */
function estimateTrainingKcalFromTss(totalTss: number, durationMin: number): number {
  if (totalTss <= 0) return 0;
  const hours = Math.max(0.25, durationMin / 60);
  const tssPerHour = totalTss / hours;
  // ~10 kcal per TSS for endurance load (order of magnitude vs mechanical estimate at IF from TSS).
  const scale = clamp(tssPerHour / 80, 0.85, 1.15);
  return round(totalTss * 10 * scale);
}

function deriveTrainingSummary(plannedTraining: PlannedTrainingEnergyInput[] = []) {
  const sessions = plannedTraining.filter((session) => {
    const duration = asFinite(session.durationMinutes) ?? 0;
    const kcal = asFinite(session.kcalTarget) ?? 0;
    const tss = asFinite(session.tssTarget) ?? 0;
    return duration > 0 || kcal > 0 || tss > 0;
  });
  const durationMin = round(
    sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.durationMinutes) ?? 0), 0),
  );
  let kcal = round(
    sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.kcalTarget) ?? 0), 0),
  );
  const totalTss = sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.tssTarget) ?? 0), 0);
  if (kcal === 0 && totalTss > 0) {
    kcal = estimateTrainingKcalFromTss(totalTss, durationMin);
  }
  const totalWeightedPower = sessions.reduce((sum, session) => {
    const avgPowerW = asFinite(session.avgPowerW);
    const durationMinutes = Math.max(0, asFinite(session.durationMinutes) ?? 0);
    return sum + (avgPowerW != null ? avgPowerW * Math.max(1, durationMinutes) : 0);
  }, 0);
  const totalPowerMinutes = sessions.reduce((sum, session) => {
    const avgPowerW = asFinite(session.avgPowerW);
    const durationMinutes = Math.max(0, asFinite(session.durationMinutes) ?? 0);
    return sum + (avgPowerW != null ? Math.max(1, durationMinutes) : 0);
  }, 0);
  const hours = durationMin > 0 ? durationMin / 60 : 0;
  const avgIntensityPctFtp =
    hours > 0 ? round(clamp(Math.sqrt(Math.max(0, totalTss / hours) / 100) * 100, 45, 120), 1) : null;
  return {
    sessionsCount: sessions.length,
    durationMin,
    kcal,
    avgIntensityPctFtp,
    avgPowerW: totalPowerMinutes > 0 ? round(totalWeightedPower / totalPowerMinutes) : null,
  };
}

function deriveEvidenceChoRange(input: {
  durationMin: number;
  avgIntensityPctFtp?: number | null;
  estimatedAvgPowerW?: number | null;
  ftpWKg?: number | null;
  vo2maxMlMinKg?: number | null;
}) {
  const duration = Math.max(0, input.durationMin);
  const intensity = asFinite(input.avgIntensityPctFtp) ?? 70;
  const avgPower = asFinite(input.estimatedAvgPowerW) ?? 0;
  const ftpWKg = asFinite(input.ftpWKg) ?? 0;
  const vo2max = asFinite(input.vo2maxMlMinKg) ?? 0;

  if (duration >= 60 && avgPower >= 300 && (ftpWKg >= 4.8 || vo2max >= 68)) {
    return { tier: "elite" as const, min: 100, target: 120, max: 130 };
  }
  if (duration >= 75 && (avgPower >= 250 || ftpWKg >= 4.2 || vo2max >= 60)) {
    return { tier: "high" as const, min: 90, target: 100, max: 110 };
  }
  if (duration < 45) {
    return { tier: "base" as const, min: 0, target: 15, max: 30 };
  }
  if (duration < 120) {
    return intensity >= 85
      ? { tier: "base" as const, min: 30, target: 50, max: 60 }
      : { tier: "base" as const, min: 20, target: 40, max: 50 };
  }
  if (duration < 180) {
    return intensity >= 85
      ? { tier: "base" as const, min: 50, target: 70, max: 90 }
      : { tier: "base" as const, min: 40, target: 60, max: 75 };
  }
  return intensity >= 85
    ? { tier: "base" as const, min: 60, target: 90, max: 90 }
    : { tier: "base" as const, min: 50, target: 75, max: 90 };
}

export function computeNutritionDailyEnergyModel(
  input: NutritionDailyEnergySolverInput,
): NutritionDailyEnergyModel {
  const bmr = deriveBmr(input);
  const lifestyleClass = normalizeLifestyleActivityClass(input.lifestyleActivityClass);
  const lifestylePct = LIFESTYLE_PCT[lifestyleClass];
  const lifestyleKcal = round(bmr.bmrKcal * lifestylePct);
  const training = deriveTrainingSummary(input.plannedTraining);
  const integration = input.performanceIntegration ?? null;
  /**
   * Modalità integrazione (`trainingEnergyScale`, `mealTrainingFraction`, `fuelingChoScale`)
   * agisce su **distribuzione/composizione** (pasti vs fueling, CHO/h, proteine, idratazione),
   * NON sul fabbisogno energetico totale: il fabbisogno deve seguire il consumo programmato
   * `BMR + lifestyle + training pianificato` (e, quando importato, l'eseguito). Vedi
   * `docs/NUTRITION_DIET_MEAL_PLAN_RULES.md` e `empathy_nutrition_diet_meal_plan_generative.mdc`.
   */
  const trainingEnergyScale = integration?.trainingEnergyScale ?? 1;
  const mealTrainingFraction = integration?.mealTrainingFraction ?? MEAL_TRAINING_FRACTION_DEFAULT;
  const fuelingChoScale = integration?.fuelingChoScale ?? 1;
  const trainingKcal = training.kcal;
  const estimatedAvgPowerW = training.avgPowerW != null
    ? training.avgPowerW
    : input.ftpWatts != null && training.avgIntensityPctFtp != null
      ? round(input.ftpWatts * (training.avgIntensityPctFtp / 100))
      : null;

  const dietScale =
    input.dietDayMealsScalePct != null && Number.isFinite(input.dietDayMealsScalePct)
      ? clamp(input.dietDayMealsScalePct, 0, 200) / 100
      : 1;

  // Decisione B: se il consumo attivo REALE del device è presente, il fabbisogno segue
  // l'osservato (BMR + attive, che già include lifestyle+training) invece della stima. Il
  // fueling intra-seduta resta dal PIANIFICATO (è struttura della seduta, non consumo globale).
  const observedActiveKcal =
    input.observedActiveKcal != null && Number.isFinite(input.observedActiveKcal) && input.observedActiveKcal >= 0
      ? input.observedActiveKcal
      : null;
  const usesObserved = observedActiveKcal != null;
  const observedTotalKcal = usesObserved ? bmr.bmrKcal + observedActiveKcal : null;

  const fuelingKcal = round(trainingKcal * (1 - mealTrainingFraction));
  const totalDailyKcal = round(
    (usesObserved ? observedTotalKcal! : bmr.bmrKcal + lifestyleKcal + trainingKcal) * dietScale,
  );
  const mealsKcal = round(
    (usesObserved
      ? Math.max(0, observedTotalKcal! - fuelingKcal)
      : bmr.bmrKcal + lifestyleKcal + trainingKcal * mealTrainingFraction) * dietScale,
  );
  const recoveryStatus = input.recoveryStatus ?? "unknown";
  const split = fuelingAroundTrainingSplit(recoveryStatus);
  /**
   * Le tre quote sono PROPORZIONI del bucket fueling, non percentuali assolute del training.
   * Perché: `fuelingKcal = trainingKcal × (1 − mealTrainingFraction)` è VARIABILE (l'integrazione
   * performance porta `mealTrainingFraction` a 0.44 o 0.48 → bucket 56% o 52%), mentre pre/intra/post
   * sommano per costruzione a `AROUND_TRAINING_TOTAL` (0.60). Applicandole a `trainingKcal` — come
   * facevano prima — con quota pasti 0.48 il bucket valeva 52% del training ma pre+intra+post ne
   * assegnavano comunque 60%: 8 punti di training kcal contati DUE volte (una nei pasti, una nel
   * fueling). Normalizzando sul bucket effettivo la regola di Mario vale sempre e
   * pre+intra+post = fuelingKcal per costruzione (a meno degli arrotondamenti a kcal intere).
   */
  const bucketScale = (1 - mealTrainingFraction) / AROUND_TRAINING_TOTAL;
  const preKcal = round(trainingKcal * split.pre * bucketScale);
  const intraKcal = round(trainingKcal * split.intra * bucketScale);
  const postKcal = round(trainingKcal * split.post * bucketScale);
  const preChoG = round(preKcal / 4, 1);
  const intraChoG = round(intraKcal / 4, 1);
  const postChoG = round(postKcal / 4, 1);
  const hours = training.durationMin > 0 ? training.durationMin / 60 : 0;
  const energyDrivenChoGPerHour = hours > 0 ? round(intraChoG / hours, 1) : 0;
  const evidenceRange = deriveEvidenceChoRange({
    durationMin: training.durationMin,
    avgIntensityPctFtp: training.avgIntensityPctFtp,
    estimatedAvgPowerW,
    ftpWKg: bmr.ftpWKg,
    vo2maxMlMinKg: input.vo2maxMlMinKg,
  });
  let adjustedChoGPerHour =
    hours > 0
      ? round(
          recoveryStatus === "poor"
            ? clamp(energyDrivenChoGPerHour, evidenceRange.min, evidenceRange.target)
            : recoveryStatus === "moderate"
              ? clamp(energyDrivenChoGPerHour, evidenceRange.min, Math.min(evidenceRange.max, evidenceRange.target + 5))
              : clamp(energyDrivenChoGPerHour, evidenceRange.min, evidenceRange.max),
          1,
        )
      : 0;
  if (hours > 0 && fuelingChoScale !== 1) {
    adjustedChoGPerHour = round(
      clamp(adjustedChoGPerHour * fuelingChoScale, evidenceRange.min, evidenceRange.max),
      1,
    );
  }

  /** Quote effettive in punti di training kcal (coincidono con la regola di Mario quando la quota pasti è 40%). */
  const pctOfTraining = (fraction: number) => round(fraction * bucketScale * 100, 1);
  const notes = [...bmr.notes];
  notes.push(
    "Daily total = BMR + lifestyle load + planned training cost (kcal del consumo programmato; sostituito dall'eseguito quando importato).",
    `Meals cover BMR + lifestyle load + ${Math.round(mealTrainingFraction * 100)}% of planned training energy.`,
    `Fueling covers the remaining ${Math.round((1 - mealTrainingFraction) * 100)}% of planned training energy: ${pctOfTraining(split.pre)}% pre, ${pctOfTraining(split.intra)}% intra, ${pctOfTraining(split.post)}% post.`,
    "Baseline = regola Mario (8 ago 2026) su recupero buono e quota pasti 40%: fueling 50% del consumo del training, 40% nei pasti, 10% pre+post workout. Il post pesa il doppio del pre (decisione proprietario 8 ago); il recupero peggiore sposta punti dall'intra al pre/post, e una quota pasti diversa dal 40% riscala le tre quote sul bucket fueling effettivo — le percentuali della riga precedente sono quelle applicate DAVVERO oggi.",
    "Evidence layer constrains intra-workout CHO/h independently from raw calorie math.",
    "Integrazione performance (recovery/bio): agisce su distribuzione pasti↔fueling, CHO/h, proteine, idratazione — NON riduce il fabbisogno energetico totale.",
  );
  if (usesObserved) {
    notes.push(
      `Consumo OSSERVATO (device): BMR ${bmr.bmrKcal} + kcal attive ${Math.round(observedActiveKcal!)} = ${observedTotalKcal} kcal. Il fabbisogno segue il consumo reale; fueling intra-seduta (${fuelingKcal} kcal) resta dal pianificato.`,
    );
  }
  if (recoveryStatus === "moderate") {
    notes.push("Recovery-aware solver active: moderate recovery shifts more energy toward pre/post support and slightly tempers intra CHO aggressiveness.");
  }
  if (recoveryStatus === "poor") {
    notes.push("Recovery-aware solver active: poor recovery protects the day by simplifying intra CHO delivery and reinforcing pre/post support.");
  }
  if (input.recoverySleepHours != null) {
    notes.push(`Recovery feed detected: sleep ${round(input.recoverySleepHours, 1)} h.`);
  }
  if (input.recoveryHrvMs != null) {
    notes.push(`Recovery feed detected: HRV ${round(input.recoveryHrvMs)} ms.`);
  }
  if (input.recoveryStrainScore != null) {
    notes.push(`Recovery feed detected: strain ${round(input.recoveryStrainScore)}.`);
  }
  if (evidenceRange.tier === "high") {
    notes.push("High-capacity athlete tier enabled: intra-workout CHO can scale into the 90-110 g/h band.");
  }
  if (evidenceRange.tier === "elite") {
    notes.push("Elite fueling tier enabled: sustained high-power sessions can scale into the 120-130 g/h band.");
  }
  if (integration) {
    notes.push(
      `Integrazione performance (informativa): indicatore recovery/bio ×${trainingEnergyScale}, quota pasti sul training ${Math.round(mealTrainingFraction * 100)}%, CHO/h ×${fuelingChoScale}. Non viene applicata al fabbisogno totale.`,
    );
    notes.push(...integration.rationale);
  }
  if (dietScale !== 1) {
    notes.push(`Profile Diet: fabbisogno pasti scalato al ${Math.round(dietScale * 100)}% del giorno (day_type_pct).`);
  }

  return {
    athleteId: input.athleteId,
    date: input.date,
    algorithmVersion: "v1",
    bmrMethod: bmr.bmrMethod,
    bmrKcal: bmr.bmrKcal,
    leanMassKg: bmr.leanMassKg,
    ageYears: bmr.ageYears,
    ftpWKg: bmr.ftpWKg,
    vo2maxMlMinKg: asFinite(input.vo2maxMlMinKg),
    lifestyle: {
      activityClass: lifestyleClass,
      pct: lifestylePct,
      kcal: lifestyleKcal,
    },
    training: {
      ...training,
      kcal: trainingKcal,
      estimatedAvgPowerW,
    },
    totals: {
      dailyKcal: totalDailyKcal,
      mealsKcal,
      fuelingKcal,
    },
    fueling: {
      capabilityTier: evidenceRange.tier,
      preKcal,
      intraKcal,
      postKcal,
      preChoG,
      intraChoG,
      postChoG,
      evidenceMinChoGPerHour: evidenceRange.min,
      evidenceTargetChoGPerHour: evidenceRange.target,
      evidenceMaxChoGPerHour: evidenceRange.max,
      energyDrivenChoGPerHour,
      adjustedChoGPerHour,
    },
    performanceIntegration: integration
      ? {
          trainingEnergyScale: integration.trainingEnergyScale,
          mealTrainingFraction: integration.mealTrainingFraction,
          fuelingChoScale: integration.fuelingChoScale,
          proteinBiasPctPoints: integration.proteinBiasPctPoints,
          hydrationFloorMultiplier: integration.hydrationFloorMultiplier,
          sessionFluidMultiplier: integration.sessionFluidMultiplier,
          rationale: integration.rationale,
          ...(integration.diaryInsight != null ? { diaryInsight: integration.diaryInsight } : {}),
        }
      : undefined,
    notes,
  };
}
