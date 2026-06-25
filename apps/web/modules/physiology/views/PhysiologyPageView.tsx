"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAthleteContext } from "@/core";
import { computeLactateEngine, computeMaxOxidateEngine } from "@/engines";
import { estimateVo2FromDevice, type SupportedSport } from "@/lib/engines/vo2-estimator";
import {
  computeMetabolicProfileEngine,
  METABOLIC_CP_ENGINE_REVISION,
  powerComponentRowNearestSec,
} from "@/lib/engines/critical-power-engine";
import { parseGasExchangeExport } from "@/lib/physiology/gas-exchange-file-parser";
import type { GasExchangeParseResult } from "@/lib/physiology/gas-exchange-file-parser";
import { substrateOxidationRatesFromGasExchange } from "@/lib/physiology/substrate-from-gas-exchange";
import { vo2LMinAtTimeOnset, vo2OnsetFractionAtTime } from "@/lib/physiology/vo2-on-kinetics";
import { METABOLIC_SIGNAL_SCHEMA_VERSION } from "@/lib/physiology/metabolic-signal-contracts";
import { gutMetricsFromTaxa } from "@/lib/physiology/derive-gut-metrics-from-context";
import {
  LactateAnalysisDataSourcesCard,
  type HealthBioGlucoseMeta,
  type SegmentAttachmentMeta,
} from "@/components/physiology/LactateAnalysisDataSourcesCard";
import { LactateMetabolicContextTiles } from "@/components/physiology/LactateMetabolicContextTiles";
import { LactatePro2NumericEngineParams } from "@/components/physiology/LactatePro2NumericEngineParams";
import { LactateWorkoutPickerPro2 } from "@/components/physiology/LactateWorkoutPickerPro2";
import { MaxOxMetabolicContextTiles } from "@/components/physiology/MaxOxMetabolicContextTiles";
import { MaxOxSegmentPanelPro2, type MaxOxSegmentForm } from "@/components/physiology/MaxOxSegmentPanelPro2";
import { MaxOxPro2NumericEngineParams } from "@/components/physiology/MaxOxPro2NumericEngineParams";
import { PhysiologyPro2LactateLab } from "@/components/physiology/PhysiologyPro2LactateLab";
import { PhysiologyPro2MaxOxLab } from "@/components/physiology/PhysiologyPro2MaxOxLab";
import { MetabolicPowerComponentsStackChart } from "@/components/physiology/MetabolicPowerComponentsStackChart";
import { MultisportCpCurveSuggestionPanel } from "@/components/physiology/MultisportCpCurveSuggestionPanel";
import { PhysiologyPro2MetabolicDashboard } from "@/components/physiology/PhysiologyPro2MetabolicDashboard";
import { MultiscaleBottleneckPanelPro2 } from "@/components/knowledge/MultiscaleBottleneckPanelPro2";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Accordion } from "@/components/ui/empathy";
import { AdminScopedPro2Link } from "@/modules/physiology/components/AdminScopedLink";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { cn } from "@/lib/cn";
import {
  fetchPhysiologyHistoryAndFtp,
  savePhysiologySnapshot,
} from "@/modules/physiology/services/physiology-snapshot-api";
import { clearVo2maxLab, saveVo2maxLab } from "@/modules/physiology/services/vo2max-lab-api";
import { Activity, Layers, Network } from "lucide-react";
import {
  bottleneckColor,
  choGapColor,
  maxOxBottleneckLabel,
  maxOxStateColor,
  zoneColorFromName,
} from "@/modules/physiology/lib/metabolic-lab-format";
import {
  CP_POINTS,
  LACTATE_DEFAULT_INPUT,
  MAXOX_DEFAULT_INPUT,
  MICROBIOTA_FIELDS,
  clamp,
  estimateRerFromFtpIntensity,
  estimateUncertaintyPct,
  initialEmptyCpInputs,
  labHistorySectionTitle,
  lerp,
  parseNum,
  patchLabStringsFromPayload,
  reliabilityBadge,
  resolveInputByPrecedence,
  sourceFromInputs,
  sportLabelIt,
  toSupportedSport,
  type CpPoint,
  type DysbiosisPreset,
  type LabRun,
  type LabSection,
  type MicrobiotaSourceMode,
  type PrecedenceSource,
  type ProCheckRow,
  type PubmedItem,
  type RerInputMode,
  type SourceTag,
  type SportSpecificPanelVm,
  type Vo2InputMode,
  type WorkoutSample,
} from "@/modules/physiology/lib/metabolic-lab-kit";
import { MetabolicLabDetailsSection } from "@/modules/physiology/views/sections/MetabolicLabDetailsSection";
import { useLactateLabState } from "@/modules/physiology/hooks/use-lactate-lab-state";

// Cache cross-mount dello storico physiology + FTP: ri-atterrando sulla pagina i
// dati compaiono subito (niente spinner "Caricamento storico…"); l'aggiornamento
// avviene in background silenzioso, così le mutazioni (salvataggio snapshot,
// import device) restano riflesse perché il fetch in background gira sempre.
let physiologyHistoryCacheId: string | null = null;
let physiologyHistoryCache: Awaited<ReturnType<typeof fetchPhysiologyHistoryAndFtp>> | null = null;

export default function MetabolicLabPage() {
  const { athleteId, role, loading, userId, adminScoped } = useAthleteContext();
  const showTech = role === "coach" || adminScoped;
  const [section, setSection] = useState<"profile" | "lactate" | "maxox" | "dettagli">("profile");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LabRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [autoInfo, setAutoInfo] = useState<string | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<PubmedItem[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [autoLactateBaseline, setAutoLactateBaseline] = useState<Record<string, number> | null>(null);
  const [autoMaxOxBaseline, setAutoMaxOxBaseline] = useState<Record<string, number> | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSample[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>("");
  const [showValidationConsole, setShowValidationConsole] = useState(false);
  const {
    lactateInput,
    setLactateInput,
    lactateSport,
    setLactateSport,
    lactateVo2Mode,
    setLactateVo2Mode,
    lactateRerMode,
    setLactateRerMode,
    lactateSegmentAttachment,
    setLactateSegmentAttachment,
    lactateCalcTick,
    setLactateCalcTick,
    lactateLastRecalcAt,
    setLactateLastRecalcAt,
  } = useLactateLabState();
  const [microbiotaSourceMode, setMicrobiotaSourceMode] = useState<MicrobiotaSourceMode>("health_bio");
  const [dysbiosisPreset, setDysbiosisPreset] = useState<DysbiosisPreset>("eubiosi");
  const [hasHealthMicrobiotaProfile, setHasHealthMicrobiotaProfile] = useState(false);
  const [healthBioGlucoseMeta, setHealthBioGlucoseMeta] = useState<HealthBioGlucoseMeta | null>(null);
  const [healthBioCoreTempCBaseline, setHealthBioCoreTempCBaseline] = useState<number | null>(null);
  const [profileVo2maxLMin, setProfileVo2maxLMin] = useState<number | null>(null);
  const [profileVo2maxMlMinKg, setProfileVo2maxMlMinKg] = useState<number | null>(null);
  /** Peso profilo da API (allinea motore CP / L·min quando i campi lab massa sono vuoti). */
  const [athleteProfileWeightKg, setAthleteProfileWeightKg] = useState<number | null>(null);
  /** ISO `created_at` ultimo snapshot salvato per sezione (da `metabolic_lab_runs`). */
  const [, setLastLabSavedAt] = useState<{
    metabolic: string | null;
    lactate: string | null;
    maxox: string | null;
  }>({ metabolic: null, lactate: null, maxox: null });
  const [fatOxAdaptation, setFatOxAdaptation] = useState(0.5);
  const [profileCalcTick, setProfileCalcTick] = useState(0);
  const [maxOxCalcTick, setMaxOxCalcTick] = useState(0);
  const [profileLastRecalcAt, setProfileLastRecalcAt] = useState<number | null>(null);
  const [maxOxLastRecalcAt, setMaxOxLastRecalcAt] = useState<number | null>(null);
  const [maxOxSegmentLastVo2LMin, setMaxOxSegmentLastVo2LMin] = useState<number | null>(null);
  const [maxOxSegmentLastO2TotalL, setMaxOxSegmentLastO2TotalL] = useState<number | null>(null);
  const [maxOxSegmentLastDurationMin, setMaxOxSegmentLastDurationMin] = useState<number | null>(null);
  const [maxOxSport, setMaxOxSport] = useState<SupportedSport>("cycling");
  const [maxOxVo2Mode, setMaxOxVo2Mode] = useState<Vo2InputMode>("device");
  const [profileRecalcHint, setProfileRecalcHint] = useState<string | null>(null);
  const [labVo2ManualInput, setLabVo2ManualInput] = useState("");
  const [labVo2Saving, setLabVo2Saving] = useState(false);
  const [labVo2Message, setLabVo2Message] = useState<string | null>(null);
  const [gasFileName, setGasFileName] = useState<string | null>(null);
  const [gasParseResult, setGasParseResult] = useState<GasExchangeParseResult | null>(null);

  const [cpInputs, setCpInputs] = useState<Record<string, string>>(() => initialEmptyCpInputs());

  const [maxOxInput, setMaxOxInput] = useState({ ...MAXOX_DEFAULT_INPUT });

  const cpCurveHasData = useMemo(
    () => CP_POINTS.some((p) => (parseFloat(String(cpInputs[p.label] ?? "").replace(",", ".")) || 0) > 0),
    [cpInputs],
  );

  const selectedHistoryRow = useMemo(
    () => (selectedHistoryId ? history.find((r) => r.id === selectedHistoryId) ?? null : null),
    [history, selectedHistoryId],
  );

  function microbiotaPresetValues(level: DysbiosisPreset) {
    if (level === "eubiosi") {
      return {
        candida_overgrowth_pct: "8",
        bifidobacteria_pct: "18",
        akkermansia_pct: "8",
        butyrate_producers_pct: "28",
        endotoxin_risk_pct: "12",
      };
    }
    if (level === "lieve") {
      return {
        candida_overgrowth_pct: "15",
        bifidobacteria_pct: "14",
        akkermansia_pct: "6",
        butyrate_producers_pct: "22",
        endotoxin_risk_pct: "20",
      };
    }
    if (level === "moderata") {
      return {
        candida_overgrowth_pct: "28",
        bifidobacteria_pct: "10",
        akkermansia_pct: "4",
        butyrate_producers_pct: "18",
        endotoxin_risk_pct: "35",
      };
    }
    if (level === "severa") {
      return {
        candida_overgrowth_pct: "42",
        bifidobacteria_pct: "7",
        akkermansia_pct: "3",
        butyrate_producers_pct: "14",
        endotoxin_risk_pct: "52",
      };
    }
    return {
      candida_overgrowth_pct: "58",
      bifidobacteria_pct: "4",
      akkermansia_pct: "2",
      butyrate_producers_pct: "9",
      endotoxin_risk_pct: "72",
    };
  }

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

  function syncMaxOxFromMetabolicProfile() {
    const eff = parseFloat(lactateInput.efficiency.replace(",", ".")) || 0.24;
    setMaxOxInput((s) => ({
      ...s,
      ftp_w: String(Math.round(cpModel.ftp)),
      body_mass_kg: String(labBodyMassKg.toFixed(1)),
      efficiency: String(eff),
    }));
    setMaxOxVo2Mode("device");
    setMaxOxCalcTick((n) => n + 1);
    setMaxOxLastRecalcAt(Date.now());
  }

  function syncMaxOxFromLactateLab() {
    const lv = lactateResolved.values;
    const rer = lactateRerUsed;
    setMaxOxInput((s) => ({
      ...s,
      body_mass_kg: String(lv.body_mass_kg),
      duration_min: String(Math.max(0.5, lv.duration_min || 60)),
      ftp_w: String(Math.round(lv.ftp_w)),
      efficiency: String(lv.efficiency),
      rer: String(Number(rer.toFixed(3))),
      power_w: String(Math.round(lv.power_w)),
      velocity_m_min: String(Number(lv.velocity_m_min.toFixed(2))),
      grade_pct: String(Number(lv.grade_pct.toFixed(2))),
      smo2_rest_pct: String(Math.round(lv.smo2_rest)),
      smo2_work_pct: String(Math.round(lv.smo2_work)),
      core_temp_c: String(lv.core_temp_c),
    }));
    setMaxOxSport(lactateSport);
    setMaxOxVo2Mode("device");
    setMaxOxCalcTick((n) => n + 1);
    setMaxOxLastRecalcAt(Date.now());
  }

  function applyMaxOxSegmentForm(form: MaxOxSegmentForm) {
    const dur = Math.max(0.01, parseFloat(String(form.duration_min).replace(",", ".")) || 1);
    const p = parseFloat(String(form.power_w).replace(",", ".")) || 0;
    if (p < 1) return;

    const eff =
      parseFloat(lactateInput.efficiency.replace(",", ".")) ||
      parseFloat(maxOxInput.efficiency.replace(",", ".")) ||
      0.24;
    const bm = labBodyMassKg;
    const ftpFromForm =
      Math.max(
        parseFloat(String(maxOxInput.ftp_w).replace(",", ".")) || 0,
        parseFloat(String(lactateInput.ftp_w).replace(",", ".")) || 0,
      ) || 0;
    const ftp = Math.max(1, ftpFromForm, cpCurveHasData ? cpModel.ftp : 0);

    const elev = parseFloat(String(form.elevation_m).replace(",", "."));
    const dist = parseFloat(String(form.distance_km).replace(",", "."));
    const manualG = parseFloat(String(form.grade_pct).replace(",", "."));
    let gradePct = 0;
    if (Number.isFinite(manualG)) gradePct = manualG;
    else if (Number.isFinite(elev) && Number.isFinite(dist) && dist > 0) gradePct = (elev / (dist * 1000)) * 100;
    else gradePct = parseFloat(maxOxInput.grade_pct.replace(",", ".")) || 0;

    const velRaw = parseFloat(String(form.velocity_m_min).replace(",", "."));
    const vel = Number.isFinite(velRaw) ? velRaw : 0;

    const intensityPct = (p / ftp) * 100;
    const rer = estimateRerFromFtpIntensity(intensityPct, fatOxAdaptation);
    const segVo2 = estimateVo2FromDevice({
      sport: maxOxSport,
      bodyMassKg: bm,
      rer,
      efficiency: eff,
      powerW: p,
      velocityMMin: vel,
      gradeFraction: gradePct / 100,
    });

    setMaxOxSegmentLastVo2LMin(segVo2.vo2LMin);
    setMaxOxSegmentLastO2TotalL(segVo2.vo2LMin * dur);
    setMaxOxSegmentLastDurationMin(dur);

    const parseOptInt = (t: string) => {
      const x = parseFloat(t.trim().replace(",", "."));
      return Number.isFinite(x) ? String(Math.round(x)) : undefined;
    };
    const parseOptFloat = (t: string) => {
      const x = parseFloat(t.trim().replace(",", "."));
      return Number.isFinite(x) ? String(Number(x.toFixed(2))) : undefined;
    };

    setMaxOxInput((s) => ({
      ...s,
      duration_min: String(Number(dur.toFixed(1))),
      power_w: String(Math.round(p)),
      ftp_w: String(Math.round(ftp)),
      body_mass_kg: String(bm.toFixed(1)),
      efficiency: String(eff),
      grade_pct: String(Number(gradePct.toFixed(2))),
      velocity_m_min: String(Number(vel.toFixed(2))),
      rer: String(Number(rer.toFixed(3))),
      vo2_l_min: String(segVo2.vo2LMin.toFixed(3)),
      smo2_work_pct: form.smo2_work.trim() ? parseOptInt(form.smo2_work) ?? s.smo2_work_pct : s.smo2_work_pct,
      smo2_rest_pct: form.smo2_rest.trim() ? parseOptInt(form.smo2_rest) ?? s.smo2_rest_pct : s.smo2_rest_pct,
      lactate_mmol_l: form.lactate_mmol.trim() ? parseOptFloat(form.lactate_mmol) ?? s.lactate_mmol_l : s.lactate_mmol_l,
      core_temp_c: form.core_temp_c.trim() ? parseOptFloat(form.core_temp_c) ?? s.core_temp_c : s.core_temp_c,
    }));
    setMaxOxVo2Mode("device");
    setMaxOxCalcTick((n) => n + 1);
    setMaxOxLastRecalcAt(Date.now());
  }

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
      ratio >= 120 ? "domanda oltre capacita ossidativa" :
      ratio >= 100 ? "domanda al limite della capacita ossidativa" :
      "domanda sotto capacita ossidativa";
    const bottleneckText = maxOxBottleneckLabel(maxOxModel.bottleneckType);
    const redoxText =
      maxOxModel.redoxStressIndex >= 65 ? "stress redox alto" :
      maxOxModel.redoxStressIndex >= 35 ? "stress redox moderato" :
      "stress redox basso";
    return { ratioText, bottleneckText, redoxText };
  }, [maxOxModel]);

  const selectedWorkout = useMemo(
    () => workouts.find((w) => w.id === selectedWorkoutId) ?? null,
    [workouts, selectedWorkoutId],
  );
  const sportSpecificPanels = useMemo<SportSpecificPanelVm[]>(() => {
    const targetSports: SupportedSport[] = ["cycling", "running", "swimming"];
    const bySport = new Map<SupportedSport, WorkoutSample[]>();
    for (const s of targetSports) bySport.set(s, []);
    for (const workout of workouts) {
      const sport = toSupportedSport(workout.sport);
      const list = bySport.get(sport);
      if (list) list.push(workout);
    }
    return targetSports.map((sport) => {
      const rows = bySport.get(sport) ?? [];
      const sessionCount = rows.length;
      const avg = (pick: (w: WorkoutSample) => number | null, digits = 1): number | null => {
        const vals = rows.map(pick).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        if (!vals.length) return null;
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        return Number(mean.toFixed(digits));
      };
      const latest = rows
        .filter((w) => typeof w.date === "string" && w.date.length >= 10)
        .sort((a, b) => (a.date > b.date ? -1 : 1))[0];
      const avgPowerW = avg((w) => w.power_w, 0);
      const avgVelocityMMin = avg((w) => w.velocity_m_min, 1);
      const avgRer = avg((w) => w.rer, 2);
      const avgVo2LMin = avg((w) => w.vo2_l_min, 2);
      const vo2EstimateMlKgMin = estimateVo2FromDevice({
        sport,
        bodyMassKg: Math.max(30, labBodyMassKg),
        rer: avgRer != null ? Math.max(0.72, Math.min(1.05, avgRer)) : 0.9,
        powerW: avgPowerW ?? undefined,
        velocityMMin: avgVelocityMMin ?? undefined,
        gradeFraction: undefined,
      }).vo2MlKgMin;
      return {
        key: sport,
        title: sportLabelIt(sport),
        sessionCount,
        avgDurationMin: avg((w) => w.duration_min, 0),
        avgTss: avg((w) => w.tss, 0),
        avgPowerW,
        avgVelocityMMin,
        avgRer,
        avgVo2LMin,
        vo2EstimateMlKgMin: Number.isFinite(vo2EstimateMlKgMin) ? Number(vo2EstimateMlKgMin.toFixed(1)) : null,
        lastDate: latest?.date ?? null,
      };
    });
  }, [workouts, labBodyMassKg, cpModel.ftp]);
  function applyWorkoutToLactate(workout: WorkoutSample) {
    const mappedSport = toSupportedSport(workout.sport);
    setLactateSport(mappedSport);
    setLactateInput((s) => {
      const fallbackDuration = Number.isFinite(parseFloat(s.duration_min)) ? parseFloat(s.duration_min) : 60;
      const fallbackPower = Number.isFinite(parseFloat(s.power_w)) ? parseFloat(s.power_w) : 0;
      const fallbackVelocity = Number.isFinite(parseFloat(s.velocity_m_min)) ? parseFloat(s.velocity_m_min) : 0;
      const fallbackGrade = Number.isFinite(parseFloat(s.grade_pct)) ? parseFloat(s.grade_pct) : 0;
      const fallbackRer = Number.isFinite(parseFloat(s.rer)) ? parseFloat(s.rer) : 0.95;
      const fallbackSmo2 = Number.isFinite(parseFloat(s.smo2_work)) ? parseFloat(s.smo2_work) : 40;
      const fallbackVo2 = Number.isFinite(parseFloat(s.vo2_l_min)) ? parseFloat(s.vo2_l_min) : 0;
      const fallbackVco2 = Number.isFinite(parseFloat(s.vco2_l_min)) ? parseFloat(s.vco2_l_min) : (fallbackVo2 * fallbackRer);
      const fallbackCoreTemp = Number.isFinite(parseFloat(s.core_temp_c)) ? parseFloat(s.core_temp_c) : 37.2;
      const fallbackGlucose = Number.isFinite(parseFloat(s.glucose_mmol_l)) ? parseFloat(s.glucose_mmol_l) : NaN;

      const duration = Math.max(1, workout.duration_min || fallbackDuration);
      const power = Math.max(0, (workout.power_w ?? fallbackPower));
      const velocity = workout.velocity_m_min ?? fallbackVelocity;
      const grade = workout.grade_pct ?? fallbackGrade;
      const rer = workout.rer ?? fallbackRer;
      const smo2 = workout.smo2 ?? fallbackSmo2;
      const vo2 = workout.vo2_l_min ?? fallbackVo2;
      const vco2 = workout.vco2_l_min ?? fallbackVco2;
      const coreTemp = workout.core_temp_c ?? fallbackCoreTemp;
      const glucoseRaw = workout.glucose_mmol_l ?? fallbackGlucose;
      const glucose = Number.isFinite(glucoseRaw) ? glucoseRaw : NaN;

      return {
        ...s,
        duration_min: String(Math.round(duration)),
        power_w: String(Math.round(power)),
        velocity_m_min: String(Number(velocity.toFixed(2))),
        grade_pct: String(Number(grade.toFixed(2))),
        rer: String(Number(rer.toFixed(2))),
        smo2_work: String(Math.round(smo2)),
        body_mass_kg: s.body_mass_kg,
        vo2_l_min: String(Number(vo2.toFixed(2))),
        vco2_l_min: String(Number(vco2.toFixed(2))),
        core_temp_c: String(Number(coreTemp.toFixed(2))),
        glucose_mmol_l: Number.isFinite(glucose) ? String(Number(glucose.toFixed(2))) : s.glucose_mmol_l,
      };
    });
  }

  const resetPhysiologyDraftForAthleteSwitch = useCallback(() => {
    setCpInputs(initialEmptyCpInputs());
    setLactateInput({ ...LACTATE_DEFAULT_INPUT });
    setMaxOxInput({ ...MAXOX_DEFAULT_INPUT });
    setAutoLactateBaseline(null);
    setAutoMaxOxBaseline(null);
    setSelectedWorkoutId("");
    setWorkouts([]);
    setHistory([]);
    setSelectedHistoryId(null);
    setAthleteProfileWeightKg(null);
    setLastLabSavedAt({ metabolic: null, lactate: null, maxox: null });
    setAutoInfo(null);
    setSaveMessage(null);
    setError(null);
    setGasFileName(null);
    setGasParseResult(null);
    setLabVo2ManualInput("");
    setLabVo2Message(null);
    setProfileRecalcHint(null);
    setEvidenceItems([]);
    setEvidenceError(null);
    setLactateSegmentAttachment(null);
    setHealthBioGlucoseMeta(null);
    setHealthBioCoreTempCBaseline(null);
  }, []);

  function applyWorkoutToMaxOx(workout: WorkoutSample) {
    const mappedSport = toSupportedSport(workout.sport);
    setMaxOxSport(mappedSport);
    setMaxOxInput((s) => {
      const fallbackPower = Number.isFinite(parseFloat(s.power_w)) ? parseFloat(s.power_w) : 0;
      const fallbackVelocity = Number.isFinite(parseFloat(s.velocity_m_min)) ? parseFloat(s.velocity_m_min) : 0;
      const fallbackGrade = Number.isFinite(parseFloat(s.grade_pct)) ? parseFloat(s.grade_pct) : 0;
      const fallbackRer = Number.isFinite(parseFloat(s.rer)) ? parseFloat(s.rer) : 0.92;
      const fallbackVo2 = Number.isFinite(parseFloat(s.vo2_l_min)) ? parseFloat(s.vo2_l_min) : 0;
      const fallbackLactate = Number.isFinite(parseFloat(s.lactate_mmol_l)) ? parseFloat(s.lactate_mmol_l) : 0;
      const fallbackSmo2 = Number.isFinite(parseFloat(s.smo2_work_pct)) ? parseFloat(s.smo2_work_pct) : 40;
      const fallbackDur = Number.isFinite(parseFloat(s.duration_min)) ? parseFloat(s.duration_min) : 60;

      const power = Math.max(0, (workout.power_w ?? fallbackPower));
      const velocity = workout.velocity_m_min ?? fallbackVelocity;
      const grade = workout.grade_pct ?? fallbackGrade;
      const rer = workout.rer ?? fallbackRer;
      const vo2 = workout.vo2_l_min ?? fallbackVo2;
      const lactate = workout.lactate_mmol_l ?? fallbackLactate;
      const workSmo2 = workout.smo2 ?? fallbackSmo2;
      const inferredRestSmo2 = Math.max(55, Math.min(85, workSmo2 + 18));
      const duration = Math.max(0.5, workout.duration_min || fallbackDur);
      return {
        ...s,
        duration_min: String(Math.round(duration)),
        power_w: String(Math.round(power)),
        velocity_m_min: String(Number(velocity.toFixed(2))),
        grade_pct: String(Number(grade.toFixed(2))),
        rer: String(Number(rer.toFixed(2))),
        vo2_l_min: String(Number(vo2.toFixed(2))),
        lactate_mmol_l: String(Number(lactate.toFixed(2))),
        smo2_work_pct: String(Math.round(workSmo2)),
        smo2_rest_pct: String(Math.round(inferredRestSmo2)),
      };
    });
  }

  function importHistoryRowToForms(row: LabRun) {
    if (row.section === "metabolic_profile") {
      setSection("profile");
      const inp = row.input_payload;
      setCpInputs(() => {
        const next = initialEmptyCpInputs();
        if (inp && typeof inp === "object") {
          for (const p of CP_POINTS) {
            const raw = (inp as Record<string, unknown>)[p.label];
            if (raw == null || raw === "") continue;
            const s = String(raw).trim();
            if (s === "") continue;
            next[p.label] = s;
          }
        }
        return next;
      });
      setSaveMessage("Snapshot profilo metabolico importato negli input.");
      setError(null);
      return;
    }
    if (row.section === "lactate_analysis") {
      setSection("lactate");
      const lacIn = row.input_payload;
      if (lacIn && typeof lacIn === "object") {
        const rec = lacIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(LACTATE_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setLactateInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setLactateSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setLactateVo2Mode(rec.vo2_mode);
        if (rec.rer_mode === "auto" || rec.rer_mode === "manual") setLactateRerMode(rec.rer_mode);
        if (
          rec.microbiota_source_mode === "health_bio" ||
          rec.microbiota_source_mode === "preset" ||
          rec.microbiota_source_mode === "manual"
        ) {
          setMicrobiotaSourceMode(rec.microbiota_source_mode);
        }
        const dp = rec.dysbiosis_preset;
        if (dp === "eubiosi" || dp === "lieve" || dp === "moderata" || dp === "severa" || dp === "grave") {
          setDysbiosisPreset(dp);
        }
        const foa = rec.fat_oxidation_adaptation;
        if (typeof foa === "number" && Number.isFinite(foa)) {
          setFatOxAdaptation(clamp(foa, 0, 1));
        }
        if (rec.segment_attachment != null && typeof rec.segment_attachment === "object") {
          setLactateSegmentAttachment(rec.segment_attachment as SegmentAttachmentMeta);
        }
        if (rec.health_bio_glucose != null && typeof rec.health_bio_glucose === "object") {
          setHealthBioGlucoseMeta(rec.health_bio_glucose as HealthBioGlucoseMeta);
        }
        if (typeof rec.health_bio_core_temp_c === "number" && Number.isFinite(rec.health_bio_core_temp_c)) {
          setHealthBioCoreTempCBaseline(rec.health_bio_core_temp_c);
        }
        setLactateCalcTick((n) => n + 1);
      }
      setSaveMessage("Snapshot analisi lattato importato negli input.");
      setError(null);
      return;
    }
    if (row.section === "max_oxidate") {
      setSection("maxox");
      const oxIn = row.input_payload;
      if (oxIn && typeof oxIn === "object") {
        const rec = oxIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(MAXOX_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setMaxOxInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setMaxOxSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setMaxOxVo2Mode(rec.vo2_mode);
        setMaxOxCalcTick((n) => n + 1);
      }
      setSaveMessage("Snapshot capacità ossidativa importato negli input.");
      setError(null);
    }
  }

  function applyHistoryPayload(payload: NonNullable<typeof physiologyHistoryCache>) {
      setLastLabSavedAt({ metabolic: null, lactate: null, maxox: null });
      const hist = (payload.history as LabRun[]) ?? [];
      setHistory(hist);
      const latestMetabolicRow =
        (payload.latestMetabolicProfileRun as LabRun | null | undefined) ??
        hist.find((r) => r.section === "metabolic_profile");
      setLastLabSavedAt((prev) => ({
        ...prev,
        metabolic: typeof latestMetabolicRow?.created_at === "string" ? latestMetabolicRow.created_at : null,
      }));
      const inp = latestMetabolicRow?.input_payload;
      setCpInputs(() => {
        const next = initialEmptyCpInputs();
        if (inp && typeof inp === "object") {
          for (const p of CP_POINTS) {
            const raw = (inp as Record<string, unknown>)[p.label];
            if (raw == null || raw === "") continue;
            const s = String(raw).trim();
            if (s === "") continue;
            next[p.label] = s;
          }
        }
        return next;
      });
      const apiWorkouts = (payload.workouts as WorkoutSample[] | undefined) ?? [];
      setWorkouts(apiWorkouts);
      if (apiWorkouts.length > 0) {
        setSelectedWorkoutId((prev) => (prev && apiWorkouts.some((w) => w.id === prev) ? prev : apiWorkouts[0].id));
      } else {
        setSelectedWorkoutId("");
      }
      if (payload.autoInputs?.sessionsAnalyzed && payload.autoInputs.sessionsAnalyzed > 0) {
        setAutoInfo(`Auto-decode attivo: ${payload.autoInputs.sessionsAnalyzed} sessioni analizzate.`);
      } else {
        setAutoInfo(null);
      }
      const pVo2L =
        payload.profileVo2maxLMin != null && Number.isFinite(payload.profileVo2maxLMin)
          ? payload.profileVo2maxLMin
          : null;
      const pVo2Ml =
        payload.profileVo2maxMlMinKg != null && Number.isFinite(payload.profileVo2maxMlMinKg)
          ? payload.profileVo2maxMlMinKg
          : null;
      setProfileVo2maxLMin(pVo2L);
      setProfileVo2maxMlMinKg(pVo2Ml);

      const aw =
        payload.athleteWeightKg != null && Number.isFinite(payload.athleteWeightKg) && payload.athleteWeightKg > 30
          ? Number(payload.athleteWeightKg)
          : null;
      setAthleteProfileWeightKg(aw);
      if (aw != null) {
        setLactateInput((s) => ({
          ...s,
          body_mass_kg: s.body_mass_kg.trim() === "" ? String(Number(aw.toFixed(1))) : s.body_mass_kg,
        }));
        setMaxOxInput((s) => ({
          ...s,
          body_mass_kg: s.body_mass_kg.trim() === "" ? String(Number(aw.toFixed(1))) : s.body_mass_kg,
        }));
      }

      if (payload.microbiotaProfile) {
        setHasHealthMicrobiotaProfile(true);
        if (microbiotaSourceMode === "health_bio") {
          setLactateInput((s) => ({
            ...s,
            candida_overgrowth_pct: String(payload.microbiotaProfile?.candida_overgrowth_pct ?? s.candida_overgrowth_pct),
            bifidobacteria_pct: String(payload.microbiotaProfile?.bifidobacteria_pct ?? s.bifidobacteria_pct),
            akkermansia_pct: String(payload.microbiotaProfile?.akkermansia_pct ?? s.akkermansia_pct),
            butyrate_producers_pct: String(payload.microbiotaProfile?.butyrate_producers_pct ?? s.butyrate_producers_pct),
            endotoxin_risk_pct: String(payload.microbiotaProfile?.endotoxin_risk_pct ?? s.endotoxin_risk_pct),
          }));
        }
      } else {
        setHasHealthMicrobiotaProfile(false);
        if (microbiotaSourceMode === "health_bio") {
          setMicrobiotaSourceMode("preset");
        }
      }

      setHealthBioGlucoseMeta(payload.healthBioGlucose ?? null);
      setHealthBioCoreTempCBaseline(
        payload.healthBioCoreTempC != null && Number.isFinite(payload.healthBioCoreTempC)
          ? payload.healthBioCoreTempC
          : null,
      );

      const lacAuto = payload.autoInputs?.lactate;
      const lactateBaselinePartial: Record<string, number> = {};
      if (lacAuto && typeof lacAuto.glucose_mmol_l === "number" && Number.isFinite(lacAuto.glucose_mmol_l)) {
        lactateBaselinePartial.glucose_mmol_l = lacAuto.glucose_mmol_l;
      }
      if (lacAuto && typeof lacAuto.core_temp_c === "number" && Number.isFinite(lacAuto.core_temp_c)) {
        lactateBaselinePartial.core_temp_c = lacAuto.core_temp_c;
      }
      setAutoLactateBaseline(Object.keys(lactateBaselinePartial).length ? lactateBaselinePartial : null);

      if (payload.healthBioGlucose != null) {
        const hbG = payload.healthBioGlucose;
        setLactateInput((s) => ({
          ...s,
          glucose_mmol_l:
            s.glucose_mmol_l.trim() === "" ? String(Number(hbG.mmol_l.toFixed(2))) : s.glucose_mmol_l,
        }));
      }
      if (payload.healthBioCoreTempC != null && Number.isFinite(payload.healthBioCoreTempC)) {
        const hbT = payload.healthBioCoreTempC;
        setLactateInput((s) => ({
          ...s,
          core_temp_c: s.core_temp_c.trim() === "" ? String(Number(hbT.toFixed(2))) : s.core_temp_c,
        }));
      }

      const lacRow =
        (payload.latestLactateRun as LabRun | null | undefined) ??
        hist.find((r) => r.section === "lactate_analysis");
      setLastLabSavedAt((prev) => ({
        ...prev,
        lactate: typeof lacRow?.created_at === "string" ? lacRow.created_at : null,
      }));
      const lacIn = lacRow?.input_payload;
      if (lacIn && typeof lacIn === "object") {
        const rec = lacIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(LACTATE_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setLactateInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setLactateSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setLactateVo2Mode(rec.vo2_mode);
        if (rec.rer_mode === "auto" || rec.rer_mode === "manual") setLactateRerMode(rec.rer_mode);
        if (
          rec.microbiota_source_mode === "health_bio" ||
          rec.microbiota_source_mode === "preset" ||
          rec.microbiota_source_mode === "manual"
        ) {
          setMicrobiotaSourceMode(rec.microbiota_source_mode);
        }
        const dp = rec.dysbiosis_preset;
        if (dp === "eubiosi" || dp === "lieve" || dp === "moderata" || dp === "severa" || dp === "grave") {
          setDysbiosisPreset(dp);
        }
        const foa = rec.fat_oxidation_adaptation;
        if (typeof foa === "number" && Number.isFinite(foa)) {
          setFatOxAdaptation(clamp(foa, 0, 1));
        }
        if (rec.segment_attachment != null && typeof rec.segment_attachment === "object") {
          setLactateSegmentAttachment(rec.segment_attachment as SegmentAttachmentMeta);
        }
        if (rec.health_bio_glucose != null && typeof rec.health_bio_glucose === "object") {
          setHealthBioGlucoseMeta(rec.health_bio_glucose as HealthBioGlucoseMeta);
        }
        if (typeof rec.health_bio_core_temp_c === "number" && Number.isFinite(rec.health_bio_core_temp_c)) {
          setHealthBioCoreTempCBaseline(rec.health_bio_core_temp_c);
        }
        setLactateCalcTick((n) => n + 1);
      }

      const oxRow =
        (payload.latestMaxOxRun as LabRun | null | undefined) ?? hist.find((r) => r.section === "max_oxidate");
      setLastLabSavedAt((prev) => ({
        ...prev,
        maxox: typeof oxRow?.created_at === "string" ? oxRow.created_at : null,
      }));
      const oxIn = oxRow?.input_payload;
      if (oxIn && typeof oxIn === "object") {
        const rec = oxIn as Record<string, unknown>;
        const patch = patchLabStringsFromPayload(rec, Object.keys(MAXOX_DEFAULT_INPUT));
        if (Object.keys(patch).length > 0) {
          setMaxOxInput((s) => ({ ...s, ...patch }));
        }
        if (typeof rec.sport === "string") setMaxOxSport(toSupportedSport(rec.sport));
        if (rec.vo2_mode === "device" || rec.vo2_mode === "test") setMaxOxVo2Mode(rec.vo2_mode);
        setMaxOxCalcTick((n) => n + 1);
      }
  }

  async function loadHistory(activeAthleteId: string) {
    setSelectedHistoryId(null);
    // Se lo storico di questo atleta è già in cache, mostralo SUBITO (niente
    // spinner "Caricamento storico…"); il refetch in background sotto aggiorna
    // comunque stato+cache, così le mutazioni restano riflesse.
    const cached = physiologyHistoryCacheId === activeAthleteId ? physiologyHistoryCache : null;
    if (cached) {
      applyHistoryPayload(cached);
      setHistoryLoading(false);
    } else {
      setHistoryLoading(true);
    }
    try {
      const payload = await fetchPhysiologyHistoryAndFtp(activeAthleteId);
      applyHistoryPayload(payload);
      physiologyHistoryCache = payload;
      physiologyHistoryCacheId = activeAthleteId;
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : "Errore caricamento storico physiology");
        setHistory([]);
        setAthleteProfileWeightKg(null);
        setLastLabSavedAt({ metabolic: null, lactate: null, maxox: null });
        setSelectedHistoryId(null);
        setWorkouts([]);
        setSelectedWorkoutId("");
        setProfileVo2maxLMin(null);
        setProfileVo2maxMlMinKg(null);
        setAutoLactateBaseline(null);
        setAutoMaxOxBaseline(null);
        setHealthBioGlucoseMeta(null);
        setHealthBioCoreTempCBaseline(null);
      }
    }
    setHistoryLoading(false);
  }

  useEffect(() => {
    if (!athleteId || !userId) return;
    resetPhysiologyDraftForAthleteSwitch();
    void loadHistory(athleteId);
  }, [athleteId, userId, resetPhysiologyDraftForAthleteSwitch]);

  useEffect(() => {
    if (microbiotaSourceMode !== "preset") return;
    const preset = microbiotaPresetValues(dysbiosisPreset);
    setLactateInput((s) => ({ ...s, ...preset }));
  }, [microbiotaSourceMode, dysbiosisPreset]);

  async function saveSnapshot(runSection: LabSection, inputPayload: Record<string, unknown>, outputPayload: Record<string, unknown>) {
    if (!athleteId) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    const createdBy = typeof window !== "undefined" ? window.localStorage.getItem("empathy_current_user_id") : null;
    const payloadVersion =
      typeof outputPayload.version === "string"
        ? outputPayload.version
        : typeof outputPayload.model_version === "string"
          ? outputPayload.model_version
          : "v0.2";
    try {
      await savePhysiologySnapshot({
        athleteId,
        runSection,
        modelVersion: payloadVersion,
        inputPayload,
        outputPayload,
        createdBy,
        profileUpdate:
          runSection === "metabolic_profile"
            ? {
              ftp_watts: cpModel.ftp,
              lt1_watts: cpModel.lt1,
              lt2_watts: cpModel.lt2,
              v_lamax: cpModel.vlamax,
              vo2max_ml_min_kg: cpModel.vo2maxMlMinKg,
              cp_watts: cpModel.cp,
              }
            : null,
      });
      setSaveMessage("Snapshot salvato: Metabolic Lab + profilo fisiologico (Supabase) aggiornati.");
      setProfileRecalcHint(null);
      await loadHistory(athleteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio snapshot physiology");
    }
    setSaving(false);
  }

  function saveMetabolicProfileSnapshot() {
    void saveSnapshot("metabolic_profile", cpInputs, {
      cp: cpModel.cp,
      ftp: cpModel.ftp,
      lt1: cpModel.lt1,
      lt2: cpModel.lt2,
      fatmax: cpModel.fatmax,
      vlamax: cpModel.vlamax,
      vo2max_ml_min_kg: cpModel.vo2maxMlMinKg,
      vo2max_l_min: cpModel.vo2maxLMin,
      vo2max_estimate: cpModel.vo2maxEstimate,
      vo2max_model_version: "empathy-vo2max-metabolic-v3",
      sprintReserve: cpModel.sprintReserve,
      wPrimeJ: cpModel.wPrimeJ,
      pcrCapacityJ: cpModel.pcrCapacityJ,
      glycolyticCapacityJ: cpModel.glycolyticCapacityJ,
      fitR2: cpModel.fitR2,
      fitConfidence: cpModel.fitConfidence,
      fitModel: cpModel.fitModel,
      phenotype: cpModel.phenotype,
      substrateTable: cpModel.substrateTable,
      powerComponents: cpModel.powerComponents,
      cpWorkTimeLinear: cpModel.cpWorkTimeLinear,
      vo2OnsetTauSecDefault: cpModel.vo2OnsetTauSecDefault,
      gasExchangeSubstrate: gasExchangeSubstrateProfile,
      metabolic_signal_schema_version: METABOLIC_SIGNAL_SCHEMA_VERSION,
      metabolic_cp_engine_revision: METABOLIC_CP_ENGINE_REVISION,
    });
  }

  function saveLactateAnalysisSnapshot() {
    void saveSnapshot(
      "lactate_analysis",
      {
        ...lactateInput,
        ...(lactateGutDerived
          ? {
              gut_absorption_pct: String(lactateGutDerived.gut_absorption_pct),
              microbiota_sequestration_pct: String(lactateGutDerived.microbiota_sequestration_pct),
              gut_training_pct: String(lactateGutDerived.gut_training_pct),
            }
          : {}),
        sport: lactateSport,
        vo2_mode: lactateVo2Mode,
        vo2_estimated_l_min: lactateVo2Estimate.vo2LMin,
        vo2_used_l_min: lactateVo2Used,
        vo2_method: lactateVo2Estimate.method,
        rer_mode: lactateRerMode,
        rer_used: lactateRerUsed,
        input_precedence_policy: "measured>manual>preset>default",
        input_uncertainty_pct: lactateUncertaintyPct,
        input_sources: lactateSourcesForSnapshot,
        microbiota_source_mode: microbiotaSourceMode,
        dysbiosis_preset: dysbiosisPreset,
        fat_oxidation_adaptation: fatOxAdaptation,
        source_workout_id: selectedWorkout?.id ?? null,
        source_workout_date: selectedWorkout?.date ?? null,
        segment_attachment: lactateSegmentAttachment,
        health_bio_glucose: healthBioGlucoseMeta,
        health_bio_core_temp_c: healthBioCoreTempCBaseline,
      },
      lactateModel,
    );
  }

  function saveMaxOxSnapshot() {
    void saveSnapshot(
      "max_oxidate",
      {
        ...maxOxInput,
        sport: maxOxSport,
        vo2_mode: maxOxVo2Mode,
        vo2_at_power_l_min: maxOxVo2AtPowerL,
        vo2_estimated_l_min: maxOxVo2AtPowerL,
        vo2_used_l_min: maxOxVo2Used,
        vo2_method:
          maxOxVo2CapacitySource === "metabolic_engine_vo2max"
            ? "metabolic_profile_cp_vo2max"
            : maxOxVo2CapacitySource === "test_manual"
              ? "test_manual"
              : maxOxVo2Estimate.method,
        vo2_capacity_source: maxOxVo2CapacitySource,
        vo2_reading_at_load_l_min: maxOxVo2AtLoadLMin,
        cp_power_split_duration_sec: maxOxModel.cpPowerSplitDurationSec,
        cp_mechanical_aerobic_ceiling_w: maxOxModel.cpMechanicalAerobicCeilingW,
        cp_power_component_label: maxOxCpPowerSplitRow?.label ?? null,
        metabolic_cp_engine_revision: METABOLIC_CP_ENGINE_REVISION,
        profile_vo2max_ml_min_kg: profileVo2maxMlMinKg,
        profile_vo2max_l_min: profileVo2maxLMin,
        input_precedence_policy: "measured>manual>preset>default",
        input_uncertainty_pct: maxOxResolved.uncertaintyPct,
        input_sources: maxOxResolved.sources,
        source_workout_id: selectedWorkout?.id ?? null,
        source_workout_date: selectedWorkout?.date ?? null,
      },
      maxOxModel,
    );
  }

  async function runEvidenceCheck() {
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const q =
        section === "lactate"
          ? "exercise lactate oxidation cori cycle glycogen endurance"
          : section === "maxox"
            ? "maximal oxidative capacity VO2 oxygen delivery mitochondrial utilization exercise"
            : "critical power FTP substrate oxidation endurance zones";
      const res = await fetch(`/api/knowledge/pubmed?q=${encodeURIComponent(q)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await res.json()) as { items?: PubmedItem[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Evidence fetch failed");
      setEvidenceItems(payload.items ?? []);
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : "Evidence fetch failed");
      setEvidenceItems([]);
    }
    setEvidenceLoading(false);
  }

  const proCheckRows = useMemo<ProCheckRow[]>(() => {
    const evidenceReady = evidenceItems.length > 0;
    if (section === "lactate") {
      const rows: Array<{
        key: string;
        label: string;
        value: number;
        valueText: string;
        min: number;
        max: number;
        keys: string[];
      }> = [
        { key: "intensity", label: "Intensity %FTP", value: lactateModel.intensityPctFtp, valueText: `${lactateModel.intensityPctFtp.toFixed(0)} %FTP`, min: 40, max: 140, keys: ["power_w", "ftp_w"] },
        { key: "glycolytic", label: "CHO share", value: lactateModel.glycolyticSharePct, valueText: `${lactateModel.glycolyticSharePct.toFixed(0)}%`, min: 25, max: 98, keys: ["rer", "smo2_work", "smo2_rest", "glucose_mmol_l"] },
        { key: "lactate_prod", label: "Lattato prodotto", value: lactateModel.lactateProducedG, valueText: `${lactateModel.lactateProducedG.toFixed(1)} g`, min: 5, max: 450, keys: ["power_w", "duration_min", "smo2_work"] },
        { key: "lactate_acc", label: "Lattato accumulato", value: lactateModel.lactateAccumG, valueText: `${lactateModel.lactateAccumG.toFixed(1)} g`, min: 0, max: 220, keys: ["lactate_oxidation_pct", "cori_pct"] },
        { key: "cho_avail", label: "CHO disponibili", value: lactateModel.choAvailableG, valueText: `${lactateModel.choAvailableG.toFixed(1)} g`, min: 0, max: 220, keys: ["cho_ingested_g_h", "gut_absorption_pct", "microbiota_sequestration_pct"] },
        { key: "glyc_net", label: "Glicogeno netto", value: lactateModel.glycogenCombustedNetG, valueText: `${lactateModel.glycogenCombustedNetG.toFixed(1)} g`, min: 0, max: 420, keys: ["duration_min", "power_w", "ftp_w"] },
      ];
      return rows.map((row) => {
        const source = sourceFromInputs(row.keys, lactateInput, autoLactateBaseline, LACTATE_DEFAULT_INPUT);
        const inRange = row.value >= row.min && row.value <= row.max;
        const aligned = inRange && evidenceReady && source !== "default";
        return {
          key: row.key,
          label: row.label,
          valueText: row.valueText,
          source,
          inRange,
          evidenceReady,
          aligned,
          rangeText: `${row.min} - ${row.max}`,
        };
      });
    }
    if (section === "maxox") {
      const rows: Array<{
        key: string;
        label: string;
        value: number;
        valueText: string;
        min: number;
        max: number;
        keys: string[];
      }> = [
        { key: "vo2rel", label: "VO2 rel", value: maxOxModel.vo2RelMlKgMin, valueText: `${maxOxModel.vo2RelMlKgMin.toFixed(1)} ml/kg/min`, min: 25, max: 95, keys: ["vo2_l_min", "body_mass_kg"] },
        {
          key: "util_ratio",
          label: "Saturazione ossidativa (P_oss / capacità)",
          value: maxOxModel.utilizationRatioPct,
          valueText: `${maxOxModel.utilizationRatioPct.toFixed(0)}%`,
          min: 5,
          max: 200,
          keys: ["power_w", "efficiency", "vo2_l_min"],
        },
        { key: "extract", label: "Extraction", value: maxOxModel.extractionPct, valueText: `${maxOxModel.extractionPct.toFixed(1)}%`, min: 8, max: 85, keys: ["smo2_rest_pct", "smo2_work_pct"] },
        { key: "central", label: "Central delivery", value: maxOxModel.centralDeliveryIndex, valueText: `${maxOxModel.centralDeliveryIndex.toFixed(2)}`, min: 0.6, max: 1.2, keys: ["hemoglobin_g_dl", "sao2_pct"] },
        { key: "peripheral", label: "Peripheral utilization", value: maxOxModel.peripheralUtilizationIndex, valueText: `${maxOxModel.peripheralUtilizationIndex.toFixed(2)}`, min: 0.45, max: 1.2, keys: ["smo2_rest_pct", "smo2_work_pct", "lactate_mmol_l"] },
        { key: "bottleneck", label: "Bottleneck index", value: maxOxModel.bottleneckIndex, valueText: `${maxOxModel.bottleneckIndex.toFixed(2)}`, min: 0, max: 1.2, keys: ["lactate_mmol_l", "lactate_trend_mmol_h", "power_w"] },
      ];
      return rows.map((row) => {
        const source = sourceFromInputs(row.keys, maxOxInput, autoMaxOxBaseline, MAXOX_DEFAULT_INPUT);
        const inRange = row.value >= row.min && row.value <= row.max;
        const aligned = inRange && evidenceReady && source !== "default";
        return {
          key: row.key,
          label: row.label,
          valueText: row.valueText,
          source,
          inRange,
          evidenceReady,
          aligned,
          rangeText: `${row.min} - ${row.max}`,
        };
      });
    }
    return [];
  }, [
    section,
    evidenceItems.length,
    lactateModel,
    maxOxModel,
    lactateInput,
    maxOxInput,
    autoLactateBaseline,
    autoMaxOxBaseline,
  ]);

  const alignedRows = proCheckRows.filter((row) => row.aligned);
  const blockedRows = proCheckRows.filter((row) => !row.aligned);
  const canAccessValidationConsole = showTech;

  const runProfileRecalc = useCallback(() => {
    setProfileCalcTick((n) => n + 1);
    setProfileLastRecalcAt(Date.now());
    setSaveMessage(null);
    setProfileRecalcHint(
      "Calcolo aggiornato in questa pagina. Per conservarlo premi «Salva profilo metabolico» in alto: alla prossima apertura ritrovi l’ultima analisi salvata.",
    );
    window.setTimeout(() => setProfileRecalcHint(null), 14000);
    requestAnimationFrame(() => {
      document.getElementById("physiology-live-metabolic-summary")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  useEffect(() => {
    if (!athleteId || !canAccessValidationConsole || !showValidationConsole) return;
    void runEvidenceCheck();
  }, [athleteId, section, canAccessValidationConsole, showValidationConsole]);

  if (loading) {
    return (
      <Pro2ModulePageShell
        eyebrow="Il tuo motore fisiologico"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Caricamento…"
        description="Stiamo preparando i tuoi dati."
      >
        <p className="text-sm text-gray-500">Caricamento in corso…</p>
      </Pro2ModulePageShell>
    );
  }

  if (!athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow="Il tuo motore fisiologico"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Fisiologia"
        description="Per vedere la tua analisi serve un atleta attivo."
        headerActions={
          <AdminScopedPro2Link
            href="/access"
            variant="secondary"
            className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
          >
            Accesso
          </AdminScopedPro2Link>
        }
      >
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
          Nessun atleta attivo. Se sei coach, seleziona un atleta in Athletes. Se sei privato, collega il tuo profilo in
          Accesso.
        </div>
      </Pro2ModulePageShell>
    );
  }

  const physiologyTabClass = (active: boolean, _tone: "cyan" | "amber" | "rose") =>
    cn(
      "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
      active
        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
        : "border-white/10 bg-black/30 text-gray-500 hover:border-white/20 hover:text-gray-300",
    );

  return (
    <Pro2ModulePageShell
      eyebrow="Il tuo motore fisiologico"
      eyebrowClassName={moduleEyebrowClass("physiology")}
      title="Fisiologia"
      description={
        <>
          Capisci come il tuo corpo produce e usa energia: potenza, soglie e capacità aerobica.
          Scegli cosa analizzare, inserisci i dati e salva l&apos;analisi per ritrovarla la prossima volta.
        </>
      }
    >
      <div className="space-y-8">
      {error ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}
      {saveMessage ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {saveMessage}
        </div>
      ) : null}
      {profileRecalcHint ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
          {profileRecalcHint}
        </div>
      ) : null}
      <div className="sticky top-0 z-30 -mx-1 mb-4 flex flex-wrap gap-2 border-b border-white/10 bg-black/85 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-black/75">
        <button
          type="button"
          className={physiologyTabClass(section === "profile", "cyan")}
          onClick={() => setSection("profile")}
        >
          Profilo metabolico
        </button>
        <button
          type="button"
          className={physiologyTabClass(section === "lactate", "amber")}
          onClick={() => setSection("lactate")}
        >
          Analisi lattato
        </button>
        <button
          type="button"
          className={physiologyTabClass(section === "maxox", "rose")}
          onClick={() => setSection("maxox")}
        >
          Capacità ossidativa
        </button>
        <button
          type="button"
          className={physiologyTabClass(section === "dettagli", "rose")}
          onClick={() => setSection("dettagli")}
        >
          {showTech ? "Dettagli e diagnostica" : "Dettagli"}
        </button>
        {autoInfo ? (
          <span className="ml-auto self-center font-mono text-[0.65rem] text-emerald-300/90">{autoInfo}</span>
        ) : null}
      </div>

      {section === "profile" ? (
        <div className="space-y-8">
          <PhysiologyPro2MetabolicDashboard
            cpPointDefs={CP_POINTS}
            cpInputs={cpInputs}
            onCpInputChange={(label, value) => setCpInputs((s) => ({ ...s, [label]: value }))}
            model={cpModel}
          />

          {athleteId ? (
          <MultisportCpCurveSuggestionPanel
            athleteId={athleteId}
            bodyMassKg={labBodyMassKg}
            onApplyToCpInputs={(curve) => {
              setCpInputs((prev) => {
                const next = { ...prev };
                for (const [label, w] of Object.entries(curve)) {
                  if (typeof w === "number" && w > 0) next[label] = String(Math.round(w));
                }
                return next;
              });
            }}
            onAfterApply={runProfileRecalc}
          />
          ) : null}

          {cpCurveHasData ? (
            <>
          <MetabolicPowerComponentsStackChart
            rows={cpModel.powerComponents}
            engineRevision={METABOLIC_CP_ENGINE_REVISION}
          />

          <details className="collapsible-card" style={{ marginBottom: "14px" }}>
            <summary>Power components · tre vie metaboliche (P = CP + W′/t)</summary>
            <p className="session-sub-copy" style={{ marginBottom: 10, maxWidth: "58rem" }}>
              <strong>P = CP + W′/t</strong>. <strong>PCr</strong>: min su W′/t con <strong>(E<sub>PCr</sub>/t)·e<sup>−t/τ</sup></strong>. <strong>Glicolisi</strong>:{" "}
              <strong>W′/t − P<sub>PCr</sub> + CP·f<sub>∥</sub>(t)</strong> (soglia). Colonna <strong>Ossidativo</strong> = residuo. Le colonne <strong>kJ</strong> sono{" "}
              <strong>P·t alla durata della riga</strong> (energia in quel bin): i kJ PCr <strong>non</strong> restano uguali al variare di t (vecchio modello: E/t fisso).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Durata</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">P modello</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Ossidativo</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">PCr</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Glicolisi</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">kJ oss @t</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">kJ PCr @t</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">kJ glic @t</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cpModel.powerComponents.map((row) => (
                    <tr key={row.sec} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">{row.label}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{row.modelPowerW.toFixed(0)} W</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{row.aerobicW.toFixed(0)} W ({(row.aerobicPct * 100).toFixed(0)}%)</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{row.pcrW.toFixed(0)} W</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">
                        {row.glycolyticW.toFixed(0)} W (
                        {((row.glycolyticW / Math.max(1, row.modelPowerW)) * 100).toFixed(0)}%)
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{row.aerobicKJ.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{row.pcrKJ.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{row.glycolyticKJ.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details className="collapsible-card">
            <summary>Zones & substrates</summary>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Zona</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Range W</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">RER stimato</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">kcal/h</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">CHO g/h</th>
                    <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">FAT g/h</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cpModel.substrateTable.map((z) => {
                    const zoneColor = zoneColorFromName(z.name);
                    return (
                    <tr key={z.name} style={{ background: `${zoneColor}10` }}>
                      <td className="px-3 py-2">
                        <span
                          className="builder-zone-chip"
                          style={{
                            borderColor: zoneColor,
                            color: zoneColor,
                            backgroundColor: `${zoneColor}22`,
                          }}
                        >
                          {z.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{z.low.toFixed(0)}-{z.high.toFixed(0)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{z.rer.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{z.kcalH.toFixed(0)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{z.choG.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{z.fatG.toFixed(1)}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </details>
            </>
          ) : null}

          <Pro2SectionCard
            accent="emerald"
            title="VO₂max da laboratorio"
            subtitle="Inserisci il valore a mano o importa il file del test (CSV/TXT). Aggiorna il tuo profilo fisiologico."
            icon={Activity}
          >
            <p className="mb-3 text-sm text-gray-400">
              {profileVo2maxMlMinKg != null ? (
                <>
                  <strong className="text-gray-200">Profilo attuale:</strong> {profileVo2maxMlMinKg.toFixed(1)} ml/kg/min
                  {profileVo2maxLMin != null ? ` (~${profileVo2maxLMin.toFixed(2)} L/min)` : ""}.
                </>
              ) : (
                <>Nessun VO₂max da lab sul profilo: inserisci un valore o importa un file.</>
              )}
            </p>
            {labVo2Message ? <p className="mb-3 text-sm text-emerald-300/95">{labVo2Message}</p> : null}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">
                VO₂max noto (ml/kg/min)
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm tabular-nums text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  type="text"
                  inputMode="decimal"
                  placeholder="es. 58.5"
                  value={labVo2ManualInput}
                  onChange={(e) => setLabVo2ManualInput(e.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Pro2Button
                  type="button"
                  variant="primary"
                  disabled={labVo2Saving || !athleteId}
                  onClick={async () => {
                    if (!athleteId) return;
                    const v = parseFloat(labVo2ManualInput.replace(",", "."));
                    if (!Number.isFinite(v) || v < 10 || v > 100) {
                      setLabVo2Message("Inserisci un valore plausibile (circa 20–95 ml/kg/min).");
                      return;
                    }
                    setLabVo2Saving(true);
                    setLabVo2Message(null);
                    setError(null);
                    try {
                      const res = await saveVo2maxLab({
                        athleteId,
                        vo2max_ml_min_kg: v,
                        source: "manual",
                      });
                      setProfileVo2maxMlMinKg(res.vo2max_ml_min_kg);
                      const bm =
                        parseFloat(String(lactateInput.body_mass_kg).replace(",", ".")) ||
                        parseFloat(String(maxOxInput.body_mass_kg).replace(",", ".")) ||
                        70;
                      setProfileVo2maxLMin((res.vo2max_ml_min_kg * bm) / 1000);
                      setLabVo2Message("Salvato sul profilo fisiologico e registrato in Metabolic Lab (vo2max_lab).");
                      await loadHistory(athleteId);
                    } catch (err) {
                      setLabVo2Message(err instanceof Error ? err.message : "Errore salvataggio");
                    } finally {
                      setLabVo2Saving(false);
                    }
                  }}
                >
                  {labVo2Saving ? "Salvataggio…" : "Salva VO₂max manuale"}
                </Pro2Button>
              </div>
            </div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              File export (Cosmed / Cortex / CSV)
              <input
                className="mt-1 block w-full text-sm text-gray-300 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-600/80 file:px-3 file:py-1.5 file:text-white"
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setGasFileName(f.name);
                  setLabVo2Message(null);
                  try {
                    const text = await f.text();
                    setGasParseResult(parseGasExchangeExport(text, { bodyMassKg: athleteBodyMassForGasImport }));
                  } catch {
                    setGasParseResult({ ok: false, error: "Lettura file non riuscita." });
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {gasFileName ? (
              <p className="mb-2 text-xs text-gray-500">
                File: <strong className="text-gray-300">{gasFileName}</strong>
                {athleteBodyMassForGasImport != null
                  ? ` · massa per parser: ${athleteBodyMassForGasImport} kg`
                  : " · imposta massa in Lactate/MaxOx se l’export ha solo VO₂ assoluto"}
              </p>
            ) : null}
            {gasParseResult ? (
              gasParseResult.ok ? (
                <div className="mb-3 space-y-2">
                  <p className="text-sm text-gray-300">
                    Picco stimato: <strong>{gasParseResult.vo2maxMlMinKg.toFixed(1)} ml/kg/min</strong>
                    {gasParseResult.vo2maxLMin != null ? ` (~${gasParseResult.vo2maxLMin.toFixed(2)} L/min)` : ""} · riga #
                    {gasParseResult.peakRowIndex + 1} · {gasParseResult.rowCount} righe
                  </p>
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
                    disabled={labVo2Saving || !athleteId}
                    onClick={async () => {
                      if (!athleteId || !gasParseResult.ok) return;
                      setLabVo2Saving(true);
                      setLabVo2Message(null);
                      setError(null);
                      try {
                        const res = await saveVo2maxLab({
                          athleteId,
                          vo2max_ml_min_kg: gasParseResult.vo2maxMlMinKg,
                          source: "gas_exchange_file",
                          note: gasFileName,
                          parsePreview: {
                            matchedColumns: gasParseResult.matchedColumns,
                            peakRowIndex: gasParseResult.peakRowIndex,
                            rowCount: gasParseResult.rowCount,
                          },
                        });
                        setProfileVo2maxMlMinKg(res.vo2max_ml_min_kg);
                        const bm =
                          parseFloat(String(lactateInput.body_mass_kg).replace(",", ".")) ||
                          parseFloat(String(maxOxInput.body_mass_kg).replace(",", ".")) ||
                          70;
                        setProfileVo2maxLMin((res.vo2max_ml_min_kg * bm) / 1000);
                        setLabVo2Message("VO₂max da file salvato sul profilo.");
                        await loadHistory(athleteId);
                      } catch (err) {
                        setLabVo2Message(err instanceof Error ? err.message : "Errore salvataggio");
                      } finally {
                        setLabVo2Saving(false);
                      }
                    }}
                  >
                    {labVo2Saving ? "Salvataggio…" : "Applica VO₂max da file al profilo"}
                  </Pro2Button>
                </div>
              ) : (
                <p className="mb-3 text-sm text-rose-300">{gasParseResult.error}</p>
              )
            ) : null}
            <Pro2Button
              type="button"
              variant="secondary"
              disabled={labVo2Saving || !athleteId}
              onClick={async () => {
                if (!athleteId) return;
                setLabVo2Saving(true);
                setLabVo2Message(null);
                try {
                  await clearVo2maxLab(athleteId);
                  setProfileVo2maxMlMinKg(null);
                  setProfileVo2maxLMin(null);
                  setGasParseResult(null);
                  setGasFileName(null);
                  setLabVo2Message("VO₂max da lab rimosso dal profilo.");
                  await loadHistory(athleteId);
                } catch (err) {
                  setLabVo2Message(err instanceof Error ? err.message : "Errore reset");
                } finally {
                  setLabVo2Saving(false);
                }
              }}
            >
              Rimuovi VO₂max da lab dal profilo
            </Pro2Button>
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="emerald"
            title="Fisiologia sport-specifica (Bike / Run / Swim)"
            subtitle="Tre pannelli separati dalla stessa memoria atleta: confronta carico, costo metabolico e risposta per disciplina."
            icon={Layers}
          >
            <div className="grid gap-3 md:grid-cols-3">
              {sportSpecificPanels.map((panel) => (
                <article key={panel.key} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-400">{panel.title}</p>
                  <p className="mt-1 font-mono text-sm text-gray-300">
                    Sessioni: <span className="text-white">{panel.sessionCount}</span>
                    {panel.lastDate ? ` · ultima ${panel.lastDate}` : ""}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                    <span>Durata media: {panel.avgDurationMin != null ? `${Math.round(panel.avgDurationMin)} min` : "—"}</span>
                    <span>TSS medio: {panel.avgTss != null ? Math.round(panel.avgTss) : "—"}</span>
                    <span>P media: {panel.avgPowerW != null ? `${Math.round(panel.avgPowerW)} W` : "—"}</span>
                    <span>Velocita&#39;: {panel.avgVelocityMMin != null ? `${panel.avgVelocityMMin.toFixed(1)} m/min` : "—"}</span>
                    <span>RER medio: {panel.avgRer != null ? panel.avgRer.toFixed(2) : "—"}</span>
                    <span>VO₂ medio: {panel.avgVo2LMin != null ? `${panel.avgVo2LMin.toFixed(2)} L/min` : "—"}</span>
                  </div>
                  <p className="mt-2 text-xs text-amber-100/90">
                    VO₂ stimato sport-specifico:{" "}
                    <strong>{panel.vo2EstimateMlKgMin != null ? `${panel.vo2EstimateMlKgMin.toFixed(1)} ml/kg/min` : "—"}</strong>
                  </p>
                </article>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              Se una disciplina non ha sessioni recenti, il pannello resta visibile ma con metriche vuote: evita di confondere profili sport diversi.
            </p>
          </Pro2SectionCard>

          {cpCurveHasData ? (
            <details className="collapsible-card">
              <summary className="cursor-pointer text-sm font-semibold text-gray-300">
                Cross-check: cinetica VO₂ (60 s) e substrati da gas (Analisi lattato)
              </summary>
              <div className="mt-3 space-y-3 text-sm text-gray-400">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-white/5">
                      <tr className="transition-colors hover:bg-white/[0.03]">
                        <th scope="row" className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">
                          τ VO₂ default (onset)
                        </th>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-white">
                          {vo2OnsetPreview.tau} s ({cpModel.phenotype})
                        </td>
                      </tr>
                      <tr className="transition-colors hover:bg-white/[0.03]">
                        <th scope="row" className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">
                          VO₂ a 60 s (modello)
                        </th>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-white">
                          {vo2OnsetPreview.vo2At60sLMin.toFixed(2)} L/min ≈ {(vo2OnsetPreview.fracAt60s * 100).toFixed(0)}% di VO₂max stimato (
                          {cpModel.vo2maxLMin.toFixed(2)} L/min)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {gasExchangeSubstrateProfile ? (
                  <p>
                    RER {gasExchangeSubstrateProfile.rer.toFixed(3)} · CHO {gasExchangeSubstrateProfile.choGPerMin.toFixed(3)} g/min · FAT{" "}
                    {gasExchangeSubstrateProfile.fatGPerMin.toFixed(3)} g/min
                    {!gasExchangeSubstrateProfile.plausible ? " (fuori banda consigliata)" : ""}
                  </p>
                ) : (
                  <p>Substrati da gas: imposta VO₂ e VCO₂ (L/min) in Analisi lattato.</p>
                )}
              </div>
            </details>
          ) : null}


          <div
            id="physiology-lab-save-bar"
            className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/[0.18] to-black/60 p-4 shadow-inner"
            role="region"
            aria-label="Riepilogo e salvataggio profilo metabolico"
          >
            <div id="physiology-live-metabolic-summary" className="space-y-3">
              {/* Riga 1: dato unico VO₂max stimato + azioni salva/ricalcola */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                  {cpCurveHasData ? (
                    <>
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">VO₂max stimato</span>
                      <span className="font-mono text-3xl font-black tabular-nums tracking-tight text-emerald-50 sm:text-4xl">
                        {cpModel.vo2maxMlMinKg.toFixed(1)}
                        <span className="ml-1 text-xs font-medium text-gray-500">ml/kg/min</span>
                      </span>
                      <span className="text-sm text-gray-400">
                        ≈ {cpModel.vo2maxLMin.toFixed(2)} L/min @ {labBodyMassKg.toFixed(0)} kg
                      </span>
                      <span className="text-sm text-gray-500">· CP {cpModel.cp.toFixed(0)} W · FTP {cpModel.ftp.toFixed(0)} W</span>
                    </>
                  ) : (
                    <span className="text-sm text-amber-200/85">
                      Compila la curva CP qui sopra: genera VO₂max, CP e FTP.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
                    onClick={runProfileRecalc}
                  >
                    Ricalcola (solo schermo)
                  </Pro2Button>
                  <Pro2Button
                    type="button"
                    variant="primary"
                    disabled={saving || !cpCurveHasData}
                    onClick={saveMetabolicProfileSnapshot}
                  >
                    {saving ? "Salvataggio…" : "Salva profilo metabolico"}
                  </Pro2Button>
                </div>
              </div>

              {/* Riga 2: VO₂max profilo/lab · auto-decode · nota */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-3 text-xs">
                {profileVo2maxMlMinKg != null && profileVo2maxMlMinKg > 0 ? (
                  <span className="text-gray-400">
                    VO₂max profilo/lab:{" "}
                    <span className="font-mono tabular-nums text-white">{profileVo2maxMlMinKg.toFixed(1)} ml/kg/min</span>
                    {profileVo2maxLMin != null ? (
                      <span className="text-gray-500"> ≈ {profileVo2maxLMin.toFixed(2)} L/min</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-gray-500">Nessun VO₂max da lab sul profilo.</span>
                )}
                {profileLastRecalcAt ? (
                  <span className="text-gray-500">
                    Ultimo ricalcolo: {new Date(profileLastRecalcAt).toLocaleTimeString("it-IT")}
                  </span>
                ) : null}
                <span className="ml-auto text-gray-500">
                  Stima da curva CP (non spirometria) · «Salva» scrive sul profilo, «Ricalcola» aggiorna a schermo.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {section === "lactate" ? (
        <div>
          <PhysiologyPro2LactateLab
            model={lactateModel}
            reliabilityPct={lactateReliability}
            uncertaintyPct={lactateUncertaintyPct}
            vo2Used={lactateVo2Used}
            vo2EstL={lactateVo2Estimate.vo2LMin}
            vo2MlKg={lactateVo2Estimate.vo2MlKgMin}
            rerUsed={lactateRerUsed}
            choGap={lactateStrategy.choGap}
            fuelingHint={lactateStrategy.fuelingAction}
            lactateHint={lactateStrategy.lactateAction}
            ftpW={physiologyLabFtpW}
            lt1W={cpModel.lt1}
            lt2W={cpModel.lt2}
            vlamax={cpModel.vlamax}
            profileVo2maxMlMinKg={cpModel.vo2maxMlMinKg}
            intensityPctFtp={lactateIntensityPctFtp}
          >
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-pick">
            <LactateWorkoutPickerPro2
              workouts={workouts}
              selectedWorkoutId={selectedWorkoutId}
              onSelectWorkoutId={(id) => {
                setSelectedWorkoutId(id);
                const w = workouts.find((x) => x.id === id);
                if (w) applyWorkoutToLactate(w);
              }}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-ctx">
            <LactateMetabolicContextTiles
              lactateSport={lactateSport}
              setLactateSport={setLactateSport}
              lactateVo2Mode={lactateVo2Mode}
              setLactateVo2Mode={setLactateVo2Mode}
              lactateRerMode={lactateRerMode}
              setLactateRerMode={setLactateRerMode}
              microbiotaSourceMode={microbiotaSourceMode}
              setMicrobiotaSourceMode={setMicrobiotaSourceMode}
              dysbiosisPreset={dysbiosisPreset}
              setDysbiosisPreset={setDysbiosisPreset}
              fatOxAdaptation={fatOxAdaptation}
              setFatOxAdaptation={(v) => setFatOxAdaptation(clamp(v, 0, 1))}
              hasHealthMicrobiotaProfile={hasHealthMicrobiotaProfile}
              lactateVo2Used={lactateVo2Used}
              lactateVo2EstL={lactateVo2Estimate.vo2LMin}
              lactateVo2MlKg={lactateVo2Estimate.vo2MlKgMin}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-sources">
            <LactateAnalysisDataSourcesCard
              segmentAttachment={lactateSegmentAttachment}
              onSegmentFile={setLactateSegmentAttachment}
              hasHealthMicrobiotaProfile={hasHealthMicrobiotaProfile}
              healthBioGlucose={healthBioGlucoseMeta}
              healthBioCoreTempC={healthBioCoreTempCBaseline}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel">
            <LactatePro2NumericEngineParams
              input={lactateParamsDisplayInput}
              onInputChange={(key, v) => setLactateInput((s) => ({ ...s, [key]: v }))}
              vo2Mode={lactateVo2Mode}
              rerMode={lactateRerMode}
              microbiotaSourceMode={microbiotaSourceMode}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--notes">
          <details className="collapsible-card physiology-pro2-lab-details">
            <summary>Note pipeline CHO &amp; strategia</summary>
            <div className="session-sub-copy" style={{ marginBottom: 0 }}>
              Pipeline CHO: {lactateModel.choIngestedTotalG.toFixed(1)} g ingeriti · assorbimento parete {lactateModel.gutAbsorptionYieldPctOfIngested.toFixed(1)}% · − {lactateModel.microbiotaSequestrationG.toFixed(1)} g sequestro = {lactateModel.choIntoBloodstreamG.toFixed(1)} g disponibili al sangue (ossidati esogeni: {lactateModel.exogenousOxidizedG.toFixed(1)} g).
            </div>
            <div className="nutrition-compliance-strip physiology-pro2-lab-compliance" style={{ marginTop: "12px" }}>
              <span style={{ color: choGapColor(lactateStrategy.choGap), fontWeight: 700 }}>
                CHO gap: {lactateStrategy.choGap.toFixed(0)} g
              </span>
              <span>{lactateStrategy.fuelingAction}</span>
              <span>{lactateStrategy.lactateAction}</span>
            </div>
          </details>
          </div>
          <div className="physiology-pro2-lab-footer-actions">
            <Pro2Button type="button" variant="primary" disabled={saving} onClick={saveLactateAnalysisSnapshot}>
              {saving ? "Salvataggio…" : "Salva analisi lattato"}
            </Pro2Button>
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
              onClick={() => {
                setLactateCalcTick((n) => n + 1);
                setLactateLastRecalcAt(Date.now());
              }}
            >
              Ricalcola analisi lattato
            </Pro2Button>
            <small className="text-xs text-gray-500">
              {lactateLastRecalcAt
                ? `Ultimo ricalcolo: ${new Date(lactateLastRecalcAt).toLocaleTimeString("it-IT")} · Auto-update attivo a ogni modifica input.`
                : "Auto-update attivo a ogni modifica input."}
            </small>
          </div>
          </PhysiologyPro2LactateLab>
        </div>
      ) : null}

      {section === "maxox" ? (
        <div>
          <PhysiologyPro2MaxOxLab
            model={maxOxModel}
            reliabilityPct={maxOxReliability}
            uncertaintyPct={maxOxResolved.uncertaintyPct}
            bottleneckLabel={maxOxSummary.bottleneckText}
            ratioSummary={maxOxSummary.ratioText}
            redoxSummary={maxOxSummary.redoxText}
            vo2Used={maxOxVo2Used}
            vo2AtPowerL={maxOxVo2AtPowerL}
            vo2MlKgCapacity={maxOxVo2MlKgCapacity}
            vo2MlKgAtPower={maxOxVo2Estimate.vo2MlKgMin}
            vo2CapacitySource={maxOxVo2CapacitySource}
            vo2maxMlMinKgForCaption={cpCurveHasData && cpModel.vo2maxLMin >= 0.35 ? cpModel.vo2maxMlMinKg : null}
            vo2maxLMinForCaption={cpCurveHasData && cpModel.vo2maxLMin >= 0.35 ? cpModel.vo2maxLMin : null}
            maxOxVo2Mode={maxOxVo2Mode}
          >
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-pick">
            <LactateWorkoutPickerPro2
              variant="maxox"
              workouts={workouts}
              selectedWorkoutId={selectedWorkoutId}
              onSelectWorkoutId={(id) => {
                setSelectedWorkoutId(id);
                const w = workouts.find((x) => x.id === id);
                if (w) applyWorkoutToMaxOx(w);
              }}
            />
          </div>
          <MaxOxSegmentPanelPro2
            onSyncProfile={syncMaxOxFromMetabolicProfile}
            onSyncLactate={syncMaxOxFromLactateLab}
            onApplySegment={applyMaxOxSegmentForm}
            lastSegmentVo2LMin={maxOxSegmentLastVo2LMin}
            lastSegmentO2TotalL={maxOxSegmentLastO2TotalL}
            lastSegmentDurationMin={maxOxSegmentLastDurationMin}
          />
          <div className="physiology-pro2-lab-page-panel physiology-pro2-lab-page-panel--lac-ctx">
            <MaxOxMetabolicContextTiles
              maxOxSport={maxOxSport}
              setMaxOxSport={setMaxOxSport}
              maxOxVo2Mode={maxOxVo2Mode}
              setMaxOxVo2Mode={setMaxOxVo2Mode}
              maxOxVo2Used={maxOxVo2Used}
              maxOxVo2EstL={maxOxVo2AtPowerL}
              maxOxVo2MlKg={maxOxVo2Estimate.vo2MlKgMin}
              vo2CapacitySource={maxOxVo2CapacitySource}
              segmentVo2LMin={maxOxSegmentLastVo2LMin}
              segmentO2TotalL={maxOxSegmentLastO2TotalL}
              segmentDurationMin={maxOxSegmentLastDurationMin}
            />
          </div>
          <div className="physiology-pro2-lab-page-panel">
            <div className="mb-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-400">Fonte capacità VO₂ · riepilogo</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-gray-300">
              <div className="mb-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-400">
                VO₂ usato come capacità (max)
              </div>
              <div className="text-lg font-bold text-gray-200">{maxOxVo2Used.toFixed(2)} L/min</div>
              <div className="mt-2 text-gray-400">
                {maxOxVo2CapacitySource === "test_manual" ? (
                  <>
                    <strong className="text-gray-200">Test manuale.</strong> A questa potenza stimato ~
                    {maxOxVo2Estimate.vo2LMin.toFixed(2)} L/min ({maxOxVo2Estimate.vo2MlKgMin.toFixed(1)} ml/kg/min).
                  </>
                ) : maxOxVo2CapacitySource === "metabolic_engine_vo2max" ? (
                  <>
                    <strong className="text-gray-200">VO₂max da Profilo metabolico</strong> (blend CP/W′):{" "}
                    {cpModel.vo2maxMlMinKg.toFixed(1)} ml/kg/min · {maxOxVo2Used.toFixed(2)} L/min @{" "}
                    {labBodyMassKg.toFixed(0)} kg. A questa potenza ~{maxOxVo2Estimate.vo2LMin.toFixed(2)} L/min.
                  </>
                ) : (
                  <>
                    <strong className="text-gray-200">Solo stima da potenza</strong> ({maxOxVo2Estimate.vo2LMin.toFixed(2)}{" "}
                    L/min, {maxOxVo2Estimate.vo2MlKgMin.toFixed(1)} ml/kg/min) — per una capacità massima credibile compila la
                    curva CP in Profilo metabolico (VO₂max motore); il lab non usa più il VO₂max anagrafico come tetto.
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="physiology-pro2-lab-page-panel">
            <MaxOxPro2NumericEngineParams
              input={maxOxInput}
              onInputChange={(key, v) => setMaxOxInput((s) => ({ ...s, [key]: v }))}
              vo2Mode={maxOxVo2Mode}
            />
          </div>

          <div className="physiology-pro2-lab-footer-actions">
            <Pro2Button type="button" variant="primary" disabled={saving} onClick={saveMaxOxSnapshot}>
              {saving ? "Salvataggio…" : "Salva capacità ossidativa"}
            </Pro2Button>
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/15"
              onClick={() => {
                setMaxOxCalcTick((n) => n + 1);
                setMaxOxLastRecalcAt(Date.now());
              }}
            >
              Ricalcola capacità ossidativa
            </Pro2Button>
            <small className="text-xs text-gray-500">
              {maxOxLastRecalcAt
                ? `Ultimo ricalcolo: ${new Date(maxOxLastRecalcAt).toLocaleTimeString("it-IT")}`
                : "Premi ricalcola per forzare il refresh del modello."}
            </small>
          </div>
          </PhysiologyPro2MaxOxLab>
        </div>
      ) : null}

      {section === "dettagli" ? (
        <MetabolicLabDetailsSection
          athleteId={athleteId}
          showTech={showTech}
          role={role}
          showValidationConsole={showValidationConsole}
          onToggleValidationConsole={() => setShowValidationConsole((s) => !s)}
          lactateReliability={lactateReliability}
          maxOxReliability={maxOxReliability}
          lactateUncertaintyPct={lactateUncertaintyPct}
          maxOxUncertaintyPct={maxOxResolved.uncertaintyPct}
          evidenceLoading={evidenceLoading}
          evidenceError={evidenceError}
          evidenceItems={evidenceItems}
          onRunEvidenceCheck={runEvidenceCheck}
          proCheckRows={proCheckRows}
          alignedRows={alignedRows}
          blockedRows={blockedRows}
          history={history}
          historyLoading={historyLoading}
          selectedHistoryId={selectedHistoryId}
          onSelectHistoryId={setSelectedHistoryId}
          selectedHistoryRow={selectedHistoryRow}
          onImportHistoryRow={importHistoryRowToForms}
        />
      ) : null}
      </div>
    </Pro2ModulePageShell>
  );
}

