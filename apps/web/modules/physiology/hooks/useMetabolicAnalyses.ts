"use client";

import { useMemo } from "react";
import { computeLactateEngine, computeMaxOxidateEngine } from "@/engines";
import { estimateVo2FromDevice, type SupportedSport } from "@/lib/engines/vo2-estimator";
import {
  computeMetabolicProfileEngine,
  powerComponentRowNearestSec,
} from "@/lib/engines/critical-power-engine";
import { substrateOxidationRatesFromGasExchange } from "@/lib/physiology/substrate-from-gas-exchange";
import { vo2LMinAtTimeOnset, vo2OnsetFractionAtTime } from "@/lib/physiology/vo2-on-kinetics";
import { gutMetricsFromTaxa } from "@/lib/physiology/derive-gut-metrics-from-context";
import { maxOxBottleneckLabel } from "@/modules/physiology/lib/metabolic-lab-format";
import {
  CP_POINTS,
  LACTATE_DEFAULT_INPUT,
  MAXOX_DEFAULT_INPUT,
  MICROBIOTA_FIELDS,
  estimateRerFromFtpIntensity,
  estimateUncertaintyPct,
  resolveInputByPrecedence,
  type MicrobiotaSourceMode,
  type PrecedenceSource,
  type RerInputMode,
  type Vo2InputMode,
} from "@/modules/physiology/lib/metabolic-lab-kit";

/**
 * Hook coeso del compute metabolico (lattato + maxox + curva CP condivisa).
 *
 * Estratto da PhysiologyPageView (decomposizione God-component): lattato, maxox e
 * CP sono un grafo INTRECCIATO e non separabile — es. `physiologyLabFtpW` legge
 * `cpModel` E `lactateResolved`; `lactateModel`/`maxOxModel` leggono il modello CP;
 * `lactateVo2Estimate` legge la massa risolta del maxox. Per questo vivono tutti in
 * UN solo hook con contratto input/output chiaro.
 *
 * REGOLE (non violare):
 * - Hook PURO: solo `useMemo`/`const`, ZERO `setState`, ZERO effetti. I setter e gli
 *   handler che scrivono gli input (sync*, applyMaxOxSegmentForm, save*Snapshot)
 *   restano nel componente e leggono l'output di questo hook.
 * - Le tre tick (`profileCalcTick`/`maxOxCalcTick`/`lactateCalcTick`) servono SOLO nei
 *   dep-array dei motori per forzare il ricalcolo dai bottoni "Ricalcola": vanno
 *   replicate identiche, `tsc` non segnala se mancano.
 * - I dep-array sono a livello di sotto-campo (es. `cpModel.ftp`,
 *   `lactateResolved.values.ftp_w`, `maxOxInput.duration_min`): NON sostituire con
 *   l'oggetto intero, cambierebbe la frequenza di ricalcolo.
 */
export type UseMetabolicAnalysesParams = {
  lactateInput: Record<string, string>;
  maxOxInput: Record<string, string>;
  cpInputs: Record<string, string>;
  athleteProfileWeightKg: number | null;
  autoLactateBaseline: Record<string, number> | null;
  autoMaxOxBaseline: Record<string, number> | null;
  microbiotaSourceMode: MicrobiotaSourceMode;
  fatOxAdaptation: number;
  profileCalcTick: number;
  maxOxCalcTick: number;
  lactateCalcTick: number;
  lactateVo2Mode: Vo2InputMode;
  lactateRerMode: RerInputMode;
  lactateSport: SupportedSport;
  maxOxSport: SupportedSport;
  maxOxVo2Mode: Vo2InputMode;
};

export function useMetabolicAnalyses({
  lactateInput,
  maxOxInput,
  cpInputs,
  athleteProfileWeightKg,
  autoLactateBaseline,
  autoMaxOxBaseline,
  microbiotaSourceMode,
  fatOxAdaptation,
  profileCalcTick,
  maxOxCalcTick,
  lactateCalcTick,
  lactateVo2Mode,
  lactateRerMode,
  lactateSport,
  maxOxSport,
  maxOxVo2Mode,
}: UseMetabolicAnalysesParams) {
  const cpCurveHasData = useMemo(
    () => CP_POINTS.some((p) => (parseFloat(String(cpInputs[p.label] ?? "").replace(",", ".")) || 0) > 0),
    [cpInputs],
  );

  const labBodyMassKg = useMemo(() => {
    const l = parseFloat(String(lactateInput.body_mass_kg).replace(",", "."));
    const m = parseFloat(String(maxOxInput.body_mass_kg).replace(",", "."));
    const lactateT = String(lactateInput.body_mass_kg ?? "").trim();
    const maxOxT = String(maxOxInput.body_mass_kg ?? "").trim();
    if (lactateT !== "" && Number.isFinite(l) && l > 30 && l < 250) return l;
    if (maxOxT !== "" && Number.isFinite(m) && m > 30 && m < 250) return m;
    if (athleteProfileWeightKg != null && athleteProfileWeightKg > 30 && athleteProfileWeightKg < 250) {
      return athleteProfileWeightKg;
    }
    if (Number.isFinite(l) && l > 30) return l;
    if (Number.isFinite(m) && m > 30) return m;
    return 70;
  }, [lactateInput.body_mass_kg, maxOxInput.body_mass_kg, athleteProfileWeightKg]);

  const cpModel = useMemo(() => {
    const cpPoints = CP_POINTS.map((p) => ({
      sec: p.sec,
      powerW: parseFloat(cpInputs[p.label]) || 0,
    }));
    return computeMetabolicProfileEngine({
      cpPoints,
      bodyMassKg: labBodyMassKg,
      efficiency: parseFloat(lactateInput.efficiency) || 0.24,
    });
  }, [cpInputs, lactateInput.efficiency, labBodyMassKg, profileCalcTick]);

  const gasExchangeSubstrateProfile = useMemo(() => {
    const vo2 = parseFloat(String(lactateInput.vo2_l_min).replace(",", "."));
    const vco2Raw = parseFloat(String(lactateInput.vco2_l_min).replace(",", "."));
    const vco2 =
      Number.isFinite(vco2Raw) && vco2Raw > 0.02 ? vco2Raw : Number.isFinite(vo2) && vo2 > 0 ? vo2 * 0.92 : NaN;
    if (!Number.isFinite(vo2) || vo2 < 0.15 || !Number.isFinite(vco2)) return null;
    return substrateOxidationRatesFromGasExchange(vo2, vco2);
  }, [lactateInput.vo2_l_min, lactateInput.vco2_l_min]);

  const vo2OnsetPreview = useMemo(() => {
    const tau = cpModel.vo2OnsetTauSecDefault;
    const vmax = cpModel.vo2maxLMin;
    const t = 60;
    return {
      tau,
      vo2At60sLMin: vo2LMinAtTimeOnset(vmax, t, tau),
      fracAt60s: vo2OnsetFractionAtTime(t, tau),
    };
  }, [cpModel.vo2OnsetTauSecDefault, cpModel.vo2maxLMin]);

  const athleteBodyMassForGasImport = useMemo(() => {
    const m = parseFloat(String(lactateInput.body_mass_kg).replace(",", ".")) ||
      parseFloat(String(maxOxInput.body_mass_kg).replace(",", "."));
    if (Number.isFinite(m) && m > 30) return m;
    if (athleteProfileWeightKg != null && athleteProfileWeightKg > 30) return athleteProfileWeightKg;
    return undefined;
  }, [lactateInput.body_mass_kg, maxOxInput.body_mass_kg, athleteProfileWeightKg]);

  const lactateResolved = useMemo(() => {
    const values: Record<string, number> = {};
    const sources: Record<string, PrecedenceSource> = {};
    for (const key of Object.keys(LACTATE_DEFAULT_INPUT)) {
      const allowManualOverride =
        (key === "vo2_l_min" && lactateVo2Mode === "test") ||
        (key === "rer" && lactateRerMode === "manual") ||
        (MICROBIOTA_FIELDS.has(key) && microbiotaSourceMode === "manual");
      const resolved = resolveInputByPrecedence({
        key,
        current: lactateInput,
        autoBase: autoLactateBaseline,
        defaults: LACTATE_DEFAULT_INPUT,
        presetMode: microbiotaSourceMode === "preset",
        allowManualOverride,
      });
      values[key] = resolved.value;
      sources[key] = resolved.source;
    }
    return {
      values,
      sources,
      uncertaintyPct: estimateUncertaintyPct(Object.values(sources)),
    };
  }, [lactateInput, autoLactateBaseline, lactateVo2Mode, lactateRerMode, microbiotaSourceMode]);

  const lactateGutDerived = useMemo(() => {
    if (microbiotaSourceMode === "manual") return null;
    const v = lactateResolved.values;
    return gutMetricsFromTaxa({
      candida_overgrowth_pct: v.candida_overgrowth_pct,
      bifidobacteria_pct: v.bifidobacteria_pct,
      akkermansia_pct: v.akkermansia_pct,
      butyrate_producers_pct: v.butyrate_producers_pct,
      endotoxin_risk_pct: v.endotoxin_risk_pct,
    });
  }, [microbiotaSourceMode, lactateResolved]);

  const lactateEngineNumericValues = useMemo(() => {
    const v = { ...lactateResolved.values };
    if (microbiotaSourceMode !== "manual" && lactateGutDerived) {
      v.gut_absorption_pct = lactateGutDerived.gut_absorption_pct;
      v.microbiota_sequestration_pct = lactateGutDerived.microbiota_sequestration_pct;
      v.gut_training_pct = lactateGutDerived.gut_training_pct;
    }
    return v;
  }, [lactateResolved, microbiotaSourceMode, lactateGutDerived]);

  const lactateSourcesForSnapshot = useMemo(() => {
    const s = { ...lactateResolved.sources };
    if (microbiotaSourceMode !== "manual") {
      const tag: PrecedenceSource = microbiotaSourceMode === "health_bio" ? "measured" : "preset";
      s.gut_absorption_pct = tag;
      s.microbiota_sequestration_pct = tag;
      s.gut_training_pct = tag;
    }
    return s;
  }, [lactateResolved, microbiotaSourceMode]);

  const lactateUncertaintyPct = useMemo(
    () => estimateUncertaintyPct(Object.values(lactateSourcesForSnapshot)),
    [lactateSourcesForSnapshot],
  );

  const lactateParamsDisplayInput = useMemo(() => {
    if (microbiotaSourceMode === "manual" || !lactateGutDerived) return lactateInput;
    return {
      ...lactateInput,
      gut_absorption_pct: String(lactateGutDerived.gut_absorption_pct),
      microbiota_sequestration_pct: String(lactateGutDerived.microbiota_sequestration_pct),
      gut_training_pct: String(lactateGutDerived.gut_training_pct),
    };
  }, [lactateInput, microbiotaSourceMode, lactateGutDerived]);

  const maxOxResolved = useMemo(() => {
    const values: Record<string, number> = {};
    const sources: Record<string, PrecedenceSource> = {};
    for (const key of Object.keys(MAXOX_DEFAULT_INPUT)) {
      const resolved = resolveInputByPrecedence({
        key,
        current: maxOxInput,
        autoBase: autoMaxOxBaseline,
        defaults: MAXOX_DEFAULT_INPUT,
        presetMode: false,
        allowManualOverride: key === "vo2_l_min" && maxOxVo2Mode === "test",
      });
      values[key] = resolved.value;
      sources[key] = resolved.source;
    }
    return {
      values,
      sources,
      uncertaintyPct: estimateUncertaintyPct(Object.values(sources)),
    };
  }, [maxOxInput, autoMaxOxBaseline, maxOxVo2Mode]);

  /** %FTP e motori Lactate/MaxOx: con curva CP vuota non usare FTP derivato dal fallback motore CP. */
  const physiologyLabFtpW = useMemo(() => {
    const labFtp = lactateResolved.values.ftp_w || 0;
    if (cpCurveHasData) return Math.max(1, cpModel.ftp, labFtp);
    return Math.max(1, labFtp);
  }, [cpCurveHasData, cpModel.ftp, lactateResolved.values.ftp_w]);
  const maxOxLabFtpW = useMemo(() => {
    const labFtp = maxOxResolved.values.ftp_w || 0;
    if (cpCurveHasData) return Math.max(1, cpModel.ftp, labFtp);
    return Math.max(1, labFtp);
  }, [cpCurveHasData, cpModel.ftp, maxOxResolved.values.ftp_w]);

  const lactateVo2Estimate = useMemo(() => {
    return estimateVo2FromDevice({
      sport: lactateSport,
      bodyMassKg: lactateResolved.values.body_mass_kg || maxOxResolved.values.body_mass_kg || 70,
      rer: lactateResolved.values.rer || 0.95,
      efficiency: lactateResolved.values.efficiency || 0.24,
      powerW: lactateResolved.values.power_w || 0,
      velocityMMin: lactateResolved.values.velocity_m_min || 0,
      gradeFraction: (lactateResolved.values.grade_pct || 0) / 100,
    });
  }, [lactateSport, lactateResolved, maxOxResolved.values.body_mass_kg]);

  const lactateVo2Used =
    lactateVo2Mode === "test"
      ? lactateResolved.values.vo2_l_min || lactateVo2Estimate.vo2LMin
      : lactateVo2Estimate.vo2LMin;

  const lactateIntensityPctFtp = ((lactateResolved.values.power_w || 0) / physiologyLabFtpW) * 100;
  const lactateRerUsed =
    lactateRerMode === "auto"
      ? estimateRerFromFtpIntensity(lactateIntensityPctFtp, fatOxAdaptation)
      : lactateResolved.values.rer || 0.95;

  const lactateModel = useMemo(() => {
    const v = lactateEngineNumericValues;
    return computeLactateEngine({
      durationMin: v.duration_min || 60,
      powerW: v.power_w || 0,
      ftpW: physiologyLabFtpW,
      efficiency: v.efficiency || 0.24,
      vo2LMin: lactateVo2Used,
      vco2LMin: v.vco2_l_min || undefined,
      rer: lactateRerUsed,
      smo2Rest: v.smo2_rest || 70,
      smo2Work: v.smo2_work || 40,
      lactateOxidationPct: v.lactate_oxidation_pct || 70,
      coriPct: v.cori_pct || 18,
      choIngestedGH: v.cho_ingested_g_h || 0,
      gutAbsorptionPct: v.gut_absorption_pct || 88,
      microbiotaSequestrationPct: v.microbiota_sequestration_pct || 6,
      gutTrainingPct: v.gut_training_pct || 75,
      coreTempC: v.core_temp_c || undefined,
      candidaOvergrowthPct: v.candida_overgrowth_pct || undefined,
      bifidobacteriaPct: v.bifidobacteria_pct || undefined,
      akkermansiaPct: v.akkermansia_pct || undefined,
      butyrateProducersPct: v.butyrate_producers_pct || undefined,
      endotoxinRiskPct: v.endotoxin_risk_pct || undefined,
      bloodGlucoseMmolL: (() => {
        const g = v.glucose_mmol_l;
        return Number.isFinite(g) && g >= 2.2 && g <= 22 ? g : undefined;
      })(),
      ...(cpCurveHasData
        ? { cpW: cpModel.cp, wPrimeJ: cpModel.wPrimeJ, glycolyticIndexProxy: cpModel.vlamax }
        : {}),
    });
  }, [
    lactateEngineNumericValues,
    lactateVo2Used,
    lactateRerUsed,
    lactateCalcTick,
    physiologyLabFtpW,
    cpCurveHasData,
    cpModel.cp,
    cpModel.wPrimeJ,
    cpModel.vlamax,
  ]);

  const lactateStrategy = useMemo(() => {
    const choGap = Math.max(0, lactateModel.glucoseRequiredForStrategyG - lactateModel.choAvailableG);
    return {
      choGap,
      fuelingAction: choGap > 20 ? "Increase intra CHO or absorption efficiency." : "CHO availability aligned.",
      lactateAction: lactateModel.lactateAccumG > lactateModel.lactateOxidizedG * 0.55 ? "Reduce glycolytic peaks." : "Lactate balance stable.",
    };
  }, [lactateModel]);

  const lactateReliability = useMemo(() => {
    let score = 100;
    const energySplitGap = Math.abs(lactateModel.energyDemandKcal - (lactateModel.choKcal + lactateModel.nonChoKcal));
    if (energySplitGap > 30) score -= 15;
    const aerobicAnaerobicGap = Math.abs(lactateModel.energyDemandKcal - (lactateModel.aerobicKcal + lactateModel.anaerobicKcal));
    if (aerobicAnaerobicGap > 45) score -= 15;
    if (lactateModel.lactateProducedG < lactateModel.lactateOxidizedG + lactateModel.lactateCoriG) score -= 20;
    if (lactateModel.intensityPctFtp > 110 && lactateModel.anaerobicKcal < 0.08 * lactateModel.energyDemandKcal) score -= 20;
    if (lactateModel.choAvailableG < lactateModel.exogenousOxidizedG) score -= 10;
    if (lactateModel.glucoseRequiredForStrategyG < 0 || lactateModel.glycogenCombustedNetG < 0) score -= 10;
    const bgObs = lactateModel.bloodGlucoseMmolL;
    if (bgObs != null && bgObs < 4.0 && lactateModel.intensityPctFtp > 92) score -= 12;
    if (lactateVo2Mode === "test") {
      const gap = Math.abs(lactateVo2Used - lactateVo2Estimate.vo2LMin) / Math.max(0.2, lactateVo2Estimate.vo2LMin);
      if (gap > 0.18) score -= 20;
    }
    return Math.max(0, Math.round(score));
  }, [lactateModel, lactateVo2Mode, lactateVo2Used, lactateVo2Estimate.vo2LMin]);

  const maxOxVo2Estimate = useMemo(() => {
    return estimateVo2FromDevice({
      sport: maxOxSport,
      bodyMassKg: maxOxResolved.values.body_mass_kg || 70,
      rer: maxOxResolved.values.rer || 0.92,
      efficiency: maxOxResolved.values.efficiency || 0.24,
      powerW: maxOxResolved.values.power_w || 0,
      velocityMMin: maxOxResolved.values.velocity_m_min || 0,
      gradeFraction: (maxOxResolved.values.grade_pct || 0) / 100,
    });
  }, [maxOxSport, maxOxResolved]);

  const maxOxVo2AtPowerL = maxOxVo2Estimate.vo2LMin;

  const maxOxVo2CapacitySource = useMemo(():
    | "metabolic_engine_vo2max"
    | "power_estimate"
    | "test_manual" => {
    if (maxOxVo2Mode === "test") return "test_manual";
    if (cpCurveHasData && cpModel.vo2maxLMin >= 0.35) return "metabolic_engine_vo2max";
    return "power_estimate";
  }, [maxOxVo2Mode, cpCurveHasData, cpModel.vo2maxLMin]);

  /** Capacità ossidativa massima nel modello: solo curva CP (VO₂max motore), mai VO₂max anagrafico isolato. */
  const maxOxVo2Used =
    maxOxVo2Mode === "test"
      ? maxOxResolved.values.vo2_l_min > 0.2
        ? maxOxResolved.values.vo2_l_min
        : maxOxVo2AtPowerL
      : cpCurveHasData && cpModel.vo2maxLMin >= 0.35
        ? cpModel.vo2maxLMin
        : maxOxVo2AtPowerL;

  /** Lettura VO₂ a carico (stima da potenza o valore test): input al motore per coerenza domanda vs tetto. */
  const maxOxVo2AtLoadLMin =
    maxOxVo2Mode === "test"
      ? maxOxResolved.values.vo2_l_min > 0.2
        ? maxOxResolved.values.vo2_l_min
        : maxOxVo2AtPowerL
      : maxOxVo2AtPowerL;

  const maxOxBodyMassKg = maxOxResolved.values.body_mass_kg || 70;
  const maxOxVo2MlKgCapacity = (maxOxVo2Used * 1000) / Math.max(1, maxOxBodyMassKg);

  const maxOxOxidativeCeilingVo2LMin = useMemo(() => {
    if (cpCurveHasData && cpModel.vo2maxLMin >= 0.35) return cpModel.vo2maxLMin;
    return undefined;
  }, [cpCurveHasData, cpModel.vo2maxLMin]);

  /** Durata finestra test (s): tabella CP usa 60…3600 s — oltre 60′ si aggancia alla riga più vicina. */
  const maxOxTestDurationSec = useMemo(() => {
    const m = parseFloat(String(maxOxInput.duration_min).replace(",", "."));
    const dm = Number.isFinite(m) && m > 0.05 ? m : 60;
    return Math.round(Math.min(180, Math.max(0.5, dm)) * 60);
  }, [maxOxInput.duration_min]);

  const maxOxCpPowerSplitRow = useMemo(() => {
    if (!cpCurveHasData || !cpModel.powerComponents?.length) return null;
    return powerComponentRowNearestSec(cpModel.powerComponents, maxOxTestDurationSec);
  }, [cpCurveHasData, cpModel.powerComponents, maxOxTestDurationSec]);

  const maxOxModel = useMemo(() => {
    return computeMaxOxidateEngine({
      vo2LMin: maxOxVo2AtLoadLMin,
      bodyMassKg: maxOxResolved.values.body_mass_kg || 70,
      powerW: maxOxResolved.values.power_w || 0,
      ftpW: maxOxLabFtpW,
      ...(cpCurveHasData ? { cpW: cpModel.cp } : {}),
      oxidativeCeilingVo2LMin: maxOxOxidativeCeilingVo2LMin,
      ...(cpCurveHasData && maxOxCpPowerSplitRow != null && maxOxCpPowerSplitRow.aerobicW > 1
        ? {
            cpAerobicWFromProfile: maxOxCpPowerSplitRow.aerobicW,
            durationSecForCpSplit: maxOxTestDurationSec,
          }
        : {}),
      efficiency: maxOxResolved.values.efficiency || 0.24,
      rer: maxOxResolved.values.rer || 0.92,
      smo2RestPct: maxOxResolved.values.smo2_rest_pct || 70,
      smo2WorkPct: maxOxResolved.values.smo2_work_pct || 40,
      lactateMmolL: maxOxResolved.values.lactate_mmol_l || 0,
      lactateTrendMmolH: maxOxResolved.values.lactate_trend_mmol_h || 0,
      coreTempC: maxOxResolved.values.core_temp_c || undefined,
      hemoglobinGdL: maxOxResolved.values.hemoglobin_g_dl || 14.5,
      sao2Pct: maxOxResolved.values.sao2_pct || 97,
    });
  }, [
    maxOxResolved,
    maxOxVo2AtLoadLMin,
    maxOxCalcTick,
    cpCurveHasData,
    cpModel.cp,
    maxOxLabFtpW,
    maxOxOxidativeCeilingVo2LMin,
    maxOxCpPowerSplitRow,
    maxOxTestDurationSec,
  ]);

  const maxOxReliability = useMemo(() => {
    let score = 100;
    if (maxOxModel.oxidativeCapacityKcalMin <= 0) score -= 25;
    const pwr = maxOxResolved.values.power_w || 0;
    if (pwr > 25 && maxOxModel.requiredKcalMin <= 0) score -= 20;
    if (maxOxModel.oxidativeDemandKcalMin > maxOxModel.requiredKcalMin + 0.5) score -= 20;
    if (maxOxModel.utilizationRatioPct < 5 || maxOxModel.utilizationRatioPct > 250) score -= 20;
    if (maxOxModel.extractionPct < 5 || maxOxModel.extractionPct > 85) score -= 10;
    if (maxOxModel.centralDeliveryIndex < 0.55 || maxOxModel.centralDeliveryIndex > 1.2) score -= 10;
    if (maxOxModel.peripheralUtilizationIndex < 0.45 || maxOxModel.peripheralUtilizationIndex > 1.2) score -= 10;
    if (maxOxModel.intensityPctFtp > 115 && maxOxModel.bottleneckType === "balanced") score -= 15;
    if (maxOxVo2Mode === "test") {
      const gap = Math.abs(maxOxVo2Used - maxOxVo2AtPowerL) / Math.max(0.2, maxOxVo2AtPowerL);
      if (gap > 0.18) score -= 20;
    } else if (maxOxVo2CapacitySource === "power_estimate") {
      const gap = Math.abs(maxOxVo2Used - maxOxVo2AtPowerL) / Math.max(0.2, maxOxVo2AtPowerL);
      if (gap > 0.18) score -= 20;
    }
    return Math.max(0, Math.round(score));
  }, [maxOxModel, maxOxVo2Mode, maxOxVo2Used, maxOxVo2AtPowerL, maxOxVo2CapacitySource, maxOxResolved.values.power_w]);

  const maxOxSummary = useMemo(() => {
    const ratio = maxOxModel.utilizationRatioPct;
    const ratioText =
      ratio >= 120 ? "demand above oxidative capacity" :
      ratio >= 100 ? "demand at the limit of oxidative capacity" :
      "demand below oxidative capacity";
    const bottleneckText = maxOxBottleneckLabel(maxOxModel.bottleneckType);
    const redoxText =
      maxOxModel.redoxStressIndex >= 65 ? "high redox stress" :
      maxOxModel.redoxStressIndex >= 35 ? "moderate redox stress" :
      "low redox stress";
    return { ratioText, bottleneckText, redoxText };
  }, [maxOxModel]);

  return {
    cpCurveHasData,
    labBodyMassKg,
    cpModel,
    gasExchangeSubstrateProfile,
    vo2OnsetPreview,
    athleteBodyMassForGasImport,
    lactateResolved,
    lactateGutDerived,
    lactateSourcesForSnapshot,
    lactateUncertaintyPct,
    lactateParamsDisplayInput,
    maxOxResolved,
    physiologyLabFtpW,
    lactateVo2Estimate,
    lactateVo2Used,
    lactateIntensityPctFtp,
    lactateRerUsed,
    lactateModel,
    lactateStrategy,
    lactateReliability,
    maxOxCpPowerSplitRow,
    maxOxModel,
    maxOxReliability,
    maxOxSummary,
    maxOxVo2MlKgCapacity,
    // Intermedi catena VO2 MaxOx letti anche dal componente (JSX MaxOx lab + proCheckRows).
    maxOxVo2Estimate,
    maxOxVo2AtPowerL,
    maxOxVo2CapacitySource,
    maxOxVo2Used,
    maxOxVo2AtLoadLMin,
  };
}
