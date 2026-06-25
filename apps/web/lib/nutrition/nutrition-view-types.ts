/**
 * Tipi riga/view-model di NutritionPageView (fetta 4 della decomposizione del
 * God-component): solo definizioni di tipo, nessuna logica. Estratti per togliere
 * ~120 righe dalla view e renderli riusabili dai sotto-componenti futuri.
 */
import type { NutritionPlannedWorkoutRow } from "@/modules/nutrition/services/nutrition-module-api";
import type { FuelingCategory } from "@/lib/nutrition/fueling-product-catalog";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

export type TwinStateRow = {
  readiness?: number;
  fatigueAcute?: number;
  glycogenStatus?: number;
  adaptationScore?: number;
  redoxStressIndex?: number;
  inflammationRisk?: number;
};

export type RecoverySummaryRow = {
  status: "good" | "moderate" | "poor" | "unknown";
  guidance: string;
  sleepScore: number | null;
  readinessScore: number | null;
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHrBpm: number | null;
  sleepDurationHours: number | null;
  strainScore: number | null;
  sourceDate: string | null;
  provider: string | null;
  importedAt: string | null;
};

export type ExecutedRow = {
  id: string;
  date: string;
  duration_minutes: number;
  tss: number;
  kcal?: number | null;
  kj?: number | null;
  trace_summary?: Record<string, unknown> | null;
  lactate_mmoll: number | null;
  glucose_mmol: number | null;
  smo2: number | null;
};

export type PlannedRow = NutritionPlannedWorkoutRow & {
  id: string;
  date: string;
  type: string | null;
  duration_minutes: number;
  tss_target: number | null;
  kcal_target: number | null;
  notes: string | null;
};

export type FoodLookupItem = {
  source: "usda" | "brand-site";
  lookupTier?: string;
  fdcId?: number | null;
  catalogId?: string | null;
  label: string;
  brand: string | null;
  kcal_100: number | null;
  carbs_100: number | null;
  protein_100: number | null;
  fat_100: number | null;
  sodium_mg_100: number | null;
};

export type GarminFuelingStep = {
  phase: string;
  minute_offset: number;
  icon: string;
  protocol: string;
  cho_g: number;
  hydration_ml: number;
  notes: string;
};

export type FuelingSlot = {
  phase: string;
  time: string;
  icon: string;
  plan: string;
  cho: number;
  fluid: number;
  notes: string;
  category: FuelingCategory;
};

export type FuelingTrainingContextRow = {
  id: string;
  builderContract: Pro2BuilderSessionContract | null;
  title: string;
  family: string | null;
  discipline: string | null;
  target: string | null;
  durationMin: number;
  tss: number;
  kcal: number;
  structure: string | null;
  blockLabels: string[];
  intensityCues: string[];
  substrate: {
    estimatedIntensityPctFtp: number;
    lactateProducedG: number;
    glucoseFromCoriG: number;
    glucoseNetFromCoriG: number;
    exogenousOxidizedG: number;
    choAvailableG: number;
    glycolyticSharePct: number;
    gutPathwayRisk: string;
    bloodDeliveryPctOfIngested: number;
    glycogenCombustedNetG: number;
    glucoseRequiredForStrategyG: number;
  } | null;
  physiologicalIntent: string[];
  nutritionSupports: string[];
  inhibitorsAndRisks: string[];
  choEnergyWeight: number;
};

export type MediaAssetRow = {
  entity_type?: "meal" | "fueling" | "exercise";
  entity_key: string;
  media_kind: "image" | "video" | "gif";
  url: string;
  active: boolean;
  sort_order: number;
};
