/**
 * Profile page kit — regione PURA estratta VERBATIM da
 * `apps/web/modules/profile/views/ProfilePageView.tsx` (righe 39-396) per
 * decomporre il God-component.
 *
 * Contiene SOLO tipi, costanti e helper puri (ZERO React/JSX/hook). Nessuna
 * modifica a logica, valori, tipi o firme rispetto alla sorgente: aggiunto solo
 * `export` davanti a ogni dichiarazione. Questo kit NON importa dal componente
 * (no cicli).
 *
 * Nota: le variabili mutabili di cache cross-mount del view-model
 * (`profileVmCacheId`, `profileVmCache`, `profileVmCacheAt`, righe 393-395)
 * restano nel componente: sono stato `let` riassegnato a runtime e i binding ESM
 * importati sono read-only, quindi non possono vivere qui.
 */

import type { AthleteMemory } from "@/lib/empathy/schemas";
import { cn } from "@/lib/cn";

export type AthleteProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  birth_date: string | null;
  sex: string | null;
  timezone: string | null;
  activity_level: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  resting_hr_bpm: number | null;
  max_hr_bpm: number | null;
  threshold_hr_bpm: number | null;
  diet_type: string | null;
  intolerances: string[] | null;
  allergies: string[] | null;
  food_preferences: string[] | null;
  food_exclusions: string[] | null;
  supplements: string[] | null;
  routine_summary: string | null;
  lifestyle_activity_class: string | null;
  preferred_meal_count: number | null;
  training_days_per_week: number | null;
  training_max_session_minutes: number | null;
  routine_config: Record<string, unknown> | null;
  nutrition_config: Record<string, unknown> | null;
  supplement_config: Record<string, unknown> | null;
  created_at: string;
};

export type PhysiologyRow = {
  athlete_id: string;
  ftp_watts: number | null;
  lt1_watts: number | null;
  lt2_watts: number | null;
  v_lamax: number | null;
  vo2max_ml_min_kg: number | null;
  cp_watts?: number | null;
  fatmax_watts?: number | null;
  w_prime_j?: number | null;
  pcr_capacity_j?: number | null;
  glycolytic_capacity_j?: number | null;
  fit_r2?: number | null;
  fit_confidence?: number | null;
  fit_model?: string | null;
  phenotype?: string | null;
  lactate_oxidized_g?: number | null;
  glucose_from_cori_g?: number | null;
  blood_delivery_pct_of_ingested?: number | null;
  gut_stress_score?: number | null;
  oxidative_bottleneck_index?: number | null;
  redox_stress_index?: number | null;
  baseline_hrv_ms: number | null;
};

export function mapAthleteMemoryToProfileRow(memory: AthleteMemory | null | undefined): AthleteProfileRow | null {
  const profile = memory?.profile;
  if (!profile) return null;
  return {
    id: profile.id,
    first_name: profile.firstName ?? null,
    last_name: profile.lastName ?? null,
    email: profile.email ?? null,
    birth_date: profile.birthDate ?? null,
    sex: profile.sex ?? null,
    timezone: profile.timezone ?? null,
    activity_level: profile.activityLevel ?? null,
    height_cm: profile.heightCm ?? null,
    weight_kg: profile.weightKg ?? null,
    body_fat_pct: profile.bodyFatPct ?? null,
    muscle_mass_kg: profile.muscleMassKg ?? null,
    resting_hr_bpm: profile.restingHrBpm ?? null,
    max_hr_bpm: profile.maxHrBpm ?? null,
    threshold_hr_bpm: profile.thresholdHrBpm ?? null,
    diet_type: profile.dietType ?? null,
    intolerances: profile.intolerances ?? null,
    allergies: profile.allergies ?? null,
    food_preferences: profile.foodPreferences ?? null,
    food_exclusions: profile.foodExclusions ?? null,
    supplements: profile.supplements ?? null,
    routine_summary: profile.routineSummary ?? null,
    lifestyle_activity_class: profile.lifestyleActivityClass ?? null,
    preferred_meal_count: profile.preferredMealCount ?? null,
    training_days_per_week: profile.trainingAvailability?.daysPerWeek ?? null,
    training_max_session_minutes: profile.trainingAvailability?.maxSessionMinutes ?? null,
    routine_config: profile.routineConfig ?? null,
    nutrition_config: profile.nutritionConfig ?? null,
    supplement_config: profile.supplementConfig ?? null,
    created_at: profile.createdAt ?? new Date(0).toISOString(),
  };
}

export function mapAthleteMemoryToPhysiologyRow(memory: AthleteMemory | null | undefined): PhysiologyRow | null {
  const physiology = memory?.physiology;
  if (!physiology) return null;
  return {
    athlete_id: physiology.athleteId,
    ftp_watts: physiology.physiologicalProfile.ftpWatts ?? null,
    lt1_watts: physiology.physiologicalProfile.lt1Watts ?? null,
    lt2_watts: physiology.physiologicalProfile.lt2Watts ?? null,
    v_lamax: physiology.physiologicalProfile.vLamax ?? null,
    vo2max_ml_min_kg: physiology.physiologicalProfile.vo2maxMlMinKg ?? null,
    cp_watts: physiology.metabolicProfile.cpWatts ?? null,
    fatmax_watts: physiology.metabolicProfile.fatmaxWatts ?? null,
    w_prime_j: physiology.metabolicProfile.wPrimeJ ?? null,
    pcr_capacity_j: physiology.metabolicProfile.pcrCapacityJ ?? null,
    glycolytic_capacity_j: physiology.metabolicProfile.glycolyticCapacityJ ?? null,
    fit_r2: physiology.metabolicProfile.fitR2 ?? null,
    fit_confidence: physiology.metabolicProfile.fitConfidence ?? null,
    fit_model: physiology.metabolicProfile.fitModel ?? null,
    phenotype: physiology.metabolicProfile.phenotype ?? null,
    lactate_oxidized_g: physiology.lactateProfile.lactateOxidizedG ?? null,
    glucose_from_cori_g: physiology.lactateProfile.glucoseFromCoriG ?? null,
    blood_delivery_pct_of_ingested: physiology.lactateProfile.bloodDeliveryPctOfIngested ?? null,
    gut_stress_score: physiology.lactateProfile.gutStressScore ?? null,
    oxidative_bottleneck_index: physiology.performanceProfile.oxidativeBottleneckIndex ?? null,
    redox_stress_index: physiology.performanceProfile.redoxStressIndex ?? null,
    baseline_hrv_ms: physiology.physiologicalProfile.baselineHrvMs ?? null,
  };
}

export const dietOptions = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "mediterranean",
  "paleo",
  "ketogenic",
  "low-fodmap",
  "carnivore",
  "gluten-free",
];

export const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type WeekDay = (typeof weekDays)[number];

export type RoutineDayConfig = {
  wake_time: string;
  breakfast_time: string;
  snack_time: string;
  lunch_time: string;
  afternoon_snack_time: string;
  dinner_time: string;
  night_time: string;
  day_mode: "training" | "recovery" | "race";
  has_training: boolean;
  training1_start_time: string;
  training1_duration_minutes: number;
  has_training2: boolean;
  training2_start_time: string;
  training2_duration_minutes: number;
  mobility_stretching_pct: number;
};

export type DietDayConfig = {
  meal_count_mode: "1" | "2" | "3" | "4" | "5" | "6" | "fasting" | "semi-8-16" | "semi-6-18" | "semi-4-20";
  day_type:
    | "fasting-0"
    | "severe-15-30"
    | "catabolic-50-99"
    | "normocaloric-100"
    | "anabolic-101-130";
  day_type_pct: number;
  caloric_distribution: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snacks: number;
    snack_am?: number;
    snack_pm?: number;
    snack_evening?: number;
  };
  daily_macros: {
    cho_pct: number;
    pro_pct: number;
    fat_pct: number;
  };
  meal_macro_custom: {
    breakfast: { cho_pct: number; pro_pct: number; fat_pct: number };
    lunch: { cho_pct: number; pro_pct: number; fat_pct: number };
    dinner: { cho_pct: number; pro_pct: number; fat_pct: number };
    snacks: { cho_pct: number; pro_pct: number; fat_pct: number };
  };
};

export function defaultRoutineDayConfig(): RoutineDayConfig {
  return {
    wake_time: "06:30",
    breakfast_time: "07:00",
    snack_time: "10:30",
    lunch_time: "12:30",
    afternoon_snack_time: "16:30",
    dinner_time: "19:30",
    night_time: "22:30",
    day_mode: "training",
    has_training: true,
    training1_start_time: "07:00",
    training1_duration_minutes: 75,
    has_training2: false,
    training2_start_time: "18:00",
    training2_duration_minutes: 45,
    mobility_stretching_pct: 20,
  };
}

/**
 * % calorie rappresentativa per categoria «Tipologia giorno». Scegliendo una categoria
 * il campo day_type_pct si porta a questo valore (poi il coach lo affina). Il motore di
 * generazione legge il %, quindi la categoria diventa così effettiva. Non retroattivo:
 * vale dalla generazione successiva; non tocca reintegro né piani già materializzati.
 */
export function defaultPctForDayType(dayType: DietDayConfig["day_type"]): number {
  switch (dayType) {
    case "fasting-0":
      return 0;
    case "severe-15-30":
      return 22;
    case "catabolic-50-99":
      return 75;
    case "normocaloric-100":
      return 100;
    case "anabolic-101-130":
      return 115;
    default:
      return 100;
  }
}

export function defaultDietDayConfig(): DietDayConfig {
  return {
    meal_count_mode: "4",
    day_type: "normocaloric-100",
    day_type_pct: 100,
    caloric_distribution: { breakfast: 30, lunch: 35, dinner: 25, snacks: 10 },
    daily_macros: { cho_pct: 50, pro_pct: 25, fat_pct: 25 },
    meal_macro_custom: {
      breakfast: { cho_pct: 55, pro_pct: 20, fat_pct: 25 },
      lunch: { cho_pct: 45, pro_pct: 30, fat_pct: 25 },
      dinner: { cho_pct: 40, pro_pct: 35, fat_pct: 25 },
      snacks: { cho_pct: 60, pro_pct: 20, fat_pct: 20 },
    },
  };
}

export function defaultRoutineWeek(): Record<WeekDay, RoutineDayConfig> {
  return Object.fromEntries(weekDays.map((d) => [d, defaultRoutineDayConfig()])) as Record<WeekDay, RoutineDayConfig>;
}

export function defaultDietWeek(): Record<WeekDay, DietDayConfig> {
  return Object.fromEntries(weekDays.map((d) => [d, defaultDietDayConfig()])) as Record<WeekDay, DietDayConfig>;
}

export function parseCsvList(value: string): string[] | null {
  const items = value.split(",").map((v) => v.trim()).filter(Boolean);
  return items.length ? items : null;
}

export function joinUnique(values: string[]): string[] | null {
  const unique = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  return unique.length ? unique : null;
}

export function toggleCsvToken(source: string, token: string): string {
  const list = source.split(",").map((s) => s.trim()).filter(Boolean);
  const has = list.includes(token);
  const next = has ? list.filter((v) => v !== token) : [...list, token];
  return next.join(", ");
}

export function hasDisplayValue(value: string): boolean {
  return value.trim() !== "—";
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function classifyAthleteType(params: {
  ftpPerKg: number | null;
  vLamax: number | null;
  vo2max: number | null;
}): { label: string; tone: "green" | "violet" | "amber" | "neutral" } {
  const { ftpPerKg, vLamax, vo2max } = params;
  if (ftpPerKg == null && vLamax == null && vo2max == null) {
    return { label: "Profilo in definizione", tone: "neutral" };
  }
  if ((vLamax != null && vLamax >= 0.75) || (ftpPerKg != null && ftpPerKg < 3.2 && vo2max != null && vo2max < 52)) {
    return { label: "Sprinter / Anaerobico", tone: "amber" };
  }
  if ((ftpPerKg != null && ftpPerKg >= 4.3) || (vo2max != null && vo2max >= 60)) {
    return { label: "Endurance / Diesel", tone: "green" };
  }
  if ((vLamax != null && vLamax <= 0.45) && (ftpPerKg != null && ftpPerKg >= 3.8)) {
    return { label: "Time-trialist", tone: "violet" };
  }
  return { label: "All-rounder", tone: "neutral" };
}

export function athleteTypePillClass(tone: "green" | "violet" | "amber" | "neutral") {
  if (tone === "green") return "border-emerald-500/45 bg-emerald-500/10 text-emerald-100";
  if (tone === "violet") return "border-violet-500/45 bg-violet-500/10 text-violet-100";
  if (tone === "amber") return "border-amber-500/45 bg-amber-500/10 text-amber-100";
  return "border-white/15 bg-white/5 text-gray-300";
}

export function editorTabClass(active: boolean, accent: "violet" | "cyan" | "amber" | "rose" | "slate") {
  const base =
    "rounded-xl border px-2.5 py-1.5 text-left text-[0.6rem] font-bold uppercase tracking-wider transition sm:px-4 sm:py-2 sm:text-[0.65rem]";
  const idle: Record<typeof accent, string> = {
    violet: "border-white/10 bg-black/30 text-gray-400 hover:border-violet-500/30",
    cyan: "border-white/10 bg-black/30 text-gray-400 hover:border-cyan-500/30",
    amber: "border-white/10 bg-black/30 text-gray-400 hover:border-amber-500/30",
    rose: "border-white/10 bg-black/30 text-gray-400 hover:border-rose-500/30",
    slate: "border-white/10 bg-black/30 text-gray-400 hover:border-white/25",
  };
  const activeCls: Record<typeof accent, string> = {
    violet: "border-violet-400/55 bg-violet-500/15 text-white shadow-[0_0_20px_rgba(139,92,246,0.15)]",
    cyan: "border-cyan-400/55 bg-cyan-500/15 text-white shadow-[0_0_20px_rgba(34,211,238,0.12)]",
    amber: "border-amber-400/55 bg-amber-500/15 text-white shadow-[0_0_20px_rgba(251,191,36,0.12)]",
    rose: "border-rose-400/55 bg-rose-500/15 text-white shadow-[0_0_20px_rgba(251,113,133,0.12)]",
    slate: "border-white/30 bg-white/10 text-white",
  };
  return cn(base, active ? activeCls[accent] : idle[accent]);
}

export function profileToneForEditorSection(section: "personal" | "physical" | "routine" | "nutrition" | "devices") {
  if (section === "personal") return "violet";
  if (section === "physical") return "cyan";
  if (section === "routine") return "amber";
  if (section === "devices") return "slate";
  return "rose";
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function estimateVo2maxMlMinKg(params: {
  weightKg: number | null;
  ftpWatts: number | null;
  cpWatts: number | null;
  lt2Watts: number | null;
  oxidativeCapacityKcalMin?: number | null;
}) {
  const weightKg = params.weightKg ?? null;
  if (weightKg == null || weightKg <= 0) return null;

  const oxidativeCapacityKcalMin = params.oxidativeCapacityKcalMin ?? null;
  if (oxidativeCapacityKcalMin != null && oxidativeCapacityKcalMin > 0) {
    const oxygenLitersPerMin = oxidativeCapacityKcalMin / 5;
    return round1(clampNumber((oxygenLitersPerMin * 1000) / weightKg, 35, 90));
  }

  const mapCandidates = [
    params.lt2Watts != null && params.lt2Watts > 0 ? params.lt2Watts / 0.78 : null,
    params.cpWatts != null && params.cpWatts > 0 ? params.cpWatts / 0.80 : null,
    params.ftpWatts != null && params.ftpWatts > 0 ? params.ftpWatts / 0.78 : null,
  ].filter((value): value is number => value != null && Number.isFinite(value));

  if (!mapCandidates.length) return null;
  const estimatedMapWatts = mapCandidates.reduce((sum, value) => sum + value, 0) / mapCandidates.length;
  const vo2maxMlMinKg = 7 + 10.8 * (estimatedMapWatts / weightKg);
  return round1(clampNumber(vo2maxMlMinKg, 35, 90));
}
