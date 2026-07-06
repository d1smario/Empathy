"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Activity, CheckCircle2, Droplets, Gauge, HeartPulse } from "lucide-react";
import type { LactateEngineOutput } from "@/lib/engines/lactate-engine";
import { LactatePro2EngineReport } from "@/components/physiology/LactatePro2EngineReport";
import { LactateThresholdPro2Panel } from "@/components/physiology/LactateThresholdPro2Panel";

export type PhysiologyPro2LactateLabProps = {
  model: LactateEngineOutput;
  reliabilityPct: number;
  uncertaintyPct: number;
  vo2Used: number;
  vo2EstL: number;
  vo2MlKg: number;
  rerUsed: number;
  choGap: number;
  fuelingHint: string;
  lactateHint: string;
  ftpW: number;
  lt1W: number;
  lt2W: number;
  vlamax: number;
  /** VO₂max da Metabolic Profile (CP) — preferito come riferimento massimo in UI curva lattato. */
  profileVo2maxMlMinKg?: number | null;
  intensityPctFtp: number;
  /** Report motore (energia/microbiota/Cori) visibile solo a coach/admin. */
  showTech?: boolean;
  children: ReactNode;
};

export function PhysiologyPro2LactateLab({
  model,
  reliabilityPct,
  uncertaintyPct,
  vo2Used,
  vo2EstL,
  vo2MlKg,
  rerUsed,
  choGap,
  fuelingHint,
  lactateHint,
  ftpW,
  lt1W,
  lt2W,
  vlamax,
  profileVo2maxMlMinKg,
  intensityPctFtp,
  showTech = false,
  children,
}: PhysiologyPro2LactateLabProps) {
  const t = useTranslations("PhysiologyPro2LactateLab");
  const vo2maxRefMlMinKg = Math.max(0, profileVo2maxMlMinKg ?? 0, vo2MlKg ?? 0);
  return (
    <div className="physiology-pro2-lab physiology-pro2-lab--lactate">
      {/* Ordine atleta-first (audit 2026-07): prima i KPI onesti di sessione, gli
          hint e la curva. Il report motore (energia/microbiota/Cori) e il viz
          duplicato non li vede l'atleta — il report vive dietro showTech. */}
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-overview">
        <Gauge className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>{t("qualityBanner")}</span>
        <Gauge className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-metric-row physiology-pro2-lab-metric-row--3">
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lac">
          <Droplets className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">{t("accumulatedLactate")}</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--lac-acc">{model.lactateAccumG.toFixed(1)} g</div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lac">
          <HeartPulse className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">CHO gap</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--cho-gap">{choGap.toFixed(0)} g</div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lac">
          <CheckCircle2 className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">{t("modelReliability")}</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--green">{reliabilityPct}/100</div>
          <div className="physiology-pro2-lab-metric-sub">{t("inputUncertainty", { pct: uncertaintyPct })}</div>
        </div>
      </div>

      <div className="physiology-pro2-lab-hint-strip">
        <span><strong>{t("fuelingLabel")}</strong> {fuelingHint}</span>
        <span><strong>{t("lactateLabel")}</strong> {lactateHint}</span>
      </div>

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-curve">
        <Droplets className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>{t("curveBanner")}</span>
        <Droplets className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-chart-card physiology-pro2-lab-chart-card--lactate">
        <LactateThresholdPro2Panel
          ftpW={Math.max(1, ftpW)}
          lt1W={lt1W}
          lt2W={lt2W}
          vlamax={vlamax}
          vo2maxMlMinKg={vo2maxRefMlMinKg >= 30 ? vo2maxRefMlMinKg : null}
          currentIntensityPctFtp={intensityPctFtp}
        />
      </div>

      {/* Report motore lattato: energia di sessione, destino lattato, pipeline
          CHO/gut, microbiota. Solo coach/admin (audit 2026-07). Il viz duplicato
          (LactateEnginePro2Viz) è stato eliminato: ripeteva questo report. */}
      {showTech ? (
        <>
          <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-overview">
            <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
            <span>{t("overviewBanner", { version: model.version })}</span>
            <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
          </div>
          <LactatePro2EngineReport model={model} vo2Used={vo2Used} rerUsed={rerUsed} />
        </>
      ) : null}

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-inputs">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>{t("inputsBanner")}</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-page-stack">{children}</div>
    </div>
  );
}
