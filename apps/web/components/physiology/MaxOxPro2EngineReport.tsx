"use client";

import { useTranslations } from "next-intl";
import { Activity, ArrowUpRight, HeartPulse, Sparkles, Wind, Zap } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MaxOxidateOutput } from "@/lib/engines/max-oxidate-engine";
import {
  CHART_AXIS,
  CHART_FONT,
  CHART_GRID,
  CHART_MODULE_ACCENT,
  chartTooltipStyle,
} from "@/lib/ui/chart-theme";

type Vo2LabMode = "device" | "test";

const ARC_LEN = 251.2;

function SemiGauge({
  label,
  value,
  maxScale,
  tone,
  displayText,
}: {
  label: string;
  value: number;
  maxScale: number;
  tone: "rose" | "amber" | "emerald";
  /** Se impostato, sostituisce value nel centro del gauge */
  displayText?: string;
}) {
  const frac = Math.min(Math.max(value / maxScale, 0), 1.15);
  const dash = Math.min(frac, 1) * ARC_LEN;
  const stroke =
    tone === "rose" ? "#f43f5e" : tone === "amber" ? "#fb923c" : "#34d399";
  const track = "rgba(255,255,255,0.08)";

  return (
    <div className={`physiology-pro2-eng-gauge physiology-pro2-eng-gauge--${tone}`}>
      <p className="physiology-pro2-eng-gauge-label">{label}</p>
      <svg viewBox="0 0 200 120" className="physiology-pro2-eng-gauge-svg" aria-hidden>
        <path
          d="M 28 100 A 72 72 0 0 1 172 100"
          fill="none"
          stroke={track}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 28 100 A 72 72 0 0 1 172 100"
          fill="none"
          stroke={stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${ARC_LEN}`}
          style={{ filter: `drop-shadow(0 0 12px ${stroke}55)` }}
        />
        <text x="100" y="88" textAnchor="middle" className="physiology-pro2-eng-gauge-value">
          {displayText ?? `${value.toFixed(0)}%`}
        </text>
      </svg>
    </div>
  );
}

export function MaxOxPro2EngineReport({
  model,
  reliabilityPct,
  uncertaintyPct,
  bottleneckLabel,
  ratioSummary,
  redoxSummary,
  vo2Used,
  vo2AtPowerL,
  vo2MlKgCapacity,
  vo2MlKgAtPower,
  vo2CapacitySource,
  maxOxVo2Mode,
}: {
  model: MaxOxidateOutput;
  reliabilityPct: number;
  uncertaintyPct: number;
  bottleneckLabel: string;
  ratioSummary: string;
  redoxSummary: string;
  vo2Used: number;
  vo2AtPowerL: number;
  vo2MlKgCapacity: number;
  vo2MlKgAtPower: number;
  vo2CapacitySource: "metabolic_engine_vo2max" | "power_estimate" | "test_manual";
  maxOxVo2Mode: Vo2LabMode;
}) {
  const t = useTranslations("MaxOxPro2EngineReport");
  const capLab =
    maxOxVo2Mode === "test"
      ? t("capLabTestManual")
      : vo2CapacitySource === "metabolic_engine_vo2max"
        ? t("capLabVo2max")
        : t("capLabPowerEstimate");
  const sat = model.utilizationRatioPct;
  const oversaturated = sat > 100;
  const satVisualMax = 150;
  const barData = [
    { name: t("barCentralDelivery"), v: model.centralDeliveryIndex * 100 },
    { name: t("barPeripheralUtilization"), v: model.peripheralUtilizationIndex * 100 },
  ];

  const nadhP = model.nadhPressureIndex * 100;
  const reoxP = model.reoxidationCapacityIndex * 100;

  return (
    <div className="physiology-pro2-eng-report physiology-pro2-eng-report--maxox">
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--maxox-engine">
        <Sparkles className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Max oxidate engine analysis</span>
        <Sparkles className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-eng-vo2-trio">
        <div className="physiology-pro2-eng-vo2-trio-head">
          <HeartPulse className="physiology-pro2-eng-section-ico" aria-hidden />
          <span>{t("vo2ModelTitle")}</span>
        </div>
        <div className="physiology-pro2-eng-vo2-grid">
          <div className="physiology-pro2-eng-vo2-cell physiology-pro2-eng-vo2-cell--cyan">
            <span className="physiology-pro2-eng-vo2-lab">{capLab}</span>
            <strong>{vo2Used.toFixed(1)}</strong>
            <span className="physiology-pro2-eng-vo2-unit">L/min</span>
          </div>
          <div className="physiology-pro2-eng-vo2-cell physiology-pro2-eng-vo2-cell--blue">
            <span className="physiology-pro2-eng-vo2-lab">{t("atThisPower")}</span>
            <strong>{vo2AtPowerL.toFixed(1)}</strong>
            <span className="physiology-pro2-eng-vo2-unit">{t("lminLoadEstimate")}</span>
          </div>
          <div className="physiology-pro2-eng-vo2-cell physiology-pro2-eng-vo2-cell--violet">
            <span className="physiology-pro2-eng-vo2-lab">ml/kg/min</span>
            <strong>{vo2MlKgCapacity.toFixed(1)}</strong>
            <span className="physiology-pro2-eng-vo2-unit">{t("fromCapacityAtPower", { atPower: vo2MlKgAtPower.toFixed(1) })}</span>
          </div>
        </div>
      </div>

      <div className="physiology-pro2-eng-maxox-summary-bar">
        <div>
          <span className="physiology-pro2-eng-maxox-sum-lab">{t("limitType")}</span>
          <span className="physiology-pro2-eng-maxox-sum-val physiology-pro2-eng-maxox-sum-val--cyan">{bottleneckLabel}</span>
        </div>
        <div>
          <span className="physiology-pro2-eng-maxox-sum-lab">{t("reliability")}</span>
          <span className="physiology-pro2-eng-maxox-sum-val physiology-pro2-eng-maxox-sum-val--green">{reliabilityPct}%</span>
        </div>
        <div>
          <span className="physiology-pro2-eng-maxox-sum-lab">{t("uncertainty")}</span>
          <span className="physiology-pro2-eng-maxox-sum-val physiology-pro2-eng-maxox-sum-val--amber">± {uncertaintyPct}%</span>
        </div>
      </div>
      <p className="physiology-pro2-eng-maxox-sum-sub">
        {ratioSummary} · {redoxSummary}
      </p>

      <div className="physiology-pro2-eng-section-title-row physiology-pro2-eng-section-title-row--warn">
        <Zap className="physiology-pro2-eng-section-ico" aria-hidden />
        <span>{t("engineOutputSection")}</span>
      </div>

      <div className="physiology-pro2-eng-maxox-gauges">
        <div className="physiology-pro2-eng-gauge-hero">
          <SemiGauge
            label={t("oxidativeSaturation")}
            value={sat}
            maxScale={satVisualMax}
            tone="rose"
            displayText={`${sat.toFixed(0)}%`}
          />
          {oversaturated ? (
            <span className="physiology-pro2-eng-oversat">OVERSATURATED</span>
          ) : (
            <span className="physiology-pro2-eng-sat-ok">Within capacity</span>
          )}
          <p className="physiology-pro2-eng-sat-foot">
            {t.rich("satFoot", {
              coherence: model.utilizationVo2CoherencePct.toFixed(0),
              stress: model.utilizationDeliveryStressPct.toFixed(0),
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
        <SemiGauge
          label={t("oxidativeBottleneck")}
          value={model.oxidativeBottleneckIndex}
          maxScale={100}
          tone="amber"
          displayText={`${model.oxidativeBottleneckIndex.toFixed(0)}/100`}
        />
        <SemiGauge
          label={t("redoxStress")}
          value={model.redoxStressIndex}
          maxScale={100}
          tone="emerald"
          displayText={`${model.redoxStressIndex.toFixed(0)}/100`}
        />
      </div>

      <div className="physiology-pro2-eng-maxox-bottom-kpis">
        <div className="physiology-pro2-eng-mbkpi physiology-pro2-eng-mbkpi--violet">
          <span className="physiology-pro2-eng-mbkpi-lab">{t("testIntensity")}</span>
          <strong>{model.intensityPctFtp.toFixed(0)}%</strong>
          <span className="physiology-pro2-eng-mbkpi-sub">FTP</span>
        </div>
        <div className="physiology-pro2-eng-mbkpi physiology-pro2-eng-mbkpi--green">
          <span className="physiology-pro2-eng-mbkpi-lab">{t("capacityFromVo2")}</span>
          <strong>{model.oxidativeCapacityKcalMinGross.toFixed(2)}</strong>
          <span className="physiology-pro2-eng-mbkpi-sub">{t("kcalMinNet", { net: model.oxidativeCapacityKcalMin.toFixed(2) })}</span>
        </div>
        <div className="physiology-pro2-eng-mbkpi physiology-pro2-eng-mbkpi--rose">
          <span className="physiology-pro2-eng-mbkpi-lab">{t("energyDemand")}</span>
          <strong>{model.requiredKcalMin.toFixed(2)}</strong>
          <span className="physiology-pro2-eng-mbkpi-sub">{t("kcalMinTotal")}</span>
        </div>
        <div className="physiology-pro2-eng-mbkpi physiology-pro2-eng-mbkpi--rose">
          <span className="physiology-pro2-eng-mbkpi-lab">{t("oxidativeDemandPoss")}</span>
          <strong>{model.oxidativeDemandKcalMin.toFixed(2)}</strong>
          <span className="physiology-pro2-eng-mbkpi-sub">
            {t("kcalMinNonOxid", { w: model.glycolyticPowerDemandW.toFixed(0) })}
          </span>
        </div>
      </div>

      <div className="physiology-pro2-eng-section-title-row physiology-pro2-eng-section-title-row--cyan">
        <ArrowUpRight className="physiology-pro2-eng-section-ico" aria-hidden />
        <span>{t("outputDeliverySection")}</span>
      </div>

      <div className="physiology-pro2-eng-maxox-delivery-grid">
        <div className="physiology-pro2-eng-del-card physiology-pro2-eng-del-card--green">
          <Wind className="physiology-pro2-eng-del-ico" aria-hidden />
          <span className="physiology-pro2-eng-del-lab">{t("centralO2Delivery")}</span>
          <strong>{model.centralDeliveryIndex.toFixed(2)}</strong>
        </div>
        <div className="physiology-pro2-eng-del-card physiology-pro2-eng-del-card--cyan">
          <Activity className="physiology-pro2-eng-del-ico" aria-hidden />
          <span className="physiology-pro2-eng-del-lab">{t("peripheralUtilization")}</span>
          <strong>{model.peripheralUtilizationIndex.toFixed(2)}</strong>
        </div>
        <div className="physiology-pro2-eng-del-card physiology-pro2-eng-del-card--cyan">
          <HeartPulse className="physiology-pro2-eng-del-ico" aria-hidden />
          <span className="physiology-pro2-eng-del-lab">{t("smo2Extraction")}</span>
          <strong>{model.extractionPct.toFixed(1)}%</strong>
        </div>
      </div>

      <div className="physiology-pro2-eng-nadh-row">
        <div className="physiology-pro2-eng-nadh-card">
          <p className="physiology-pro2-eng-nadh-title">{t("nadhReoxidationTitle")}</p>
          <div className="physiology-pro2-eng-nadh-bars">
            <div>
              <div className="physiology-pro2-eng-nadh-row-h">
                <span>NADH</span>
                <span>{nadhP.toFixed(0)}%</span>
              </div>
              <div className="physiology-pro2-lab-bar-track">
                <div className="physiology-pro2-lab-bar" style={{ width: `${Math.min(100, nadhP)}%`, background: "#a855f7" }} />
              </div>
            </div>
            <div>
              <div className="physiology-pro2-eng-nadh-row-h">
                <span>{t("reoxidation")}</span>
                <span>{reoxP.toFixed(0)}%</span>
              </div>
              <div className="physiology-pro2-lab-bar-track">
                <div className="physiology-pro2-lab-bar" style={{ width: `${Math.min(100, reoxP)}%`, background: "#22c55e" }} />
              </div>
            </div>
          </div>
          <div className="physiology-pro2-eng-nadh-pills">
            <span className="physiology-pro2-eng-nadh-pill physiology-pro2-eng-nadh-pill--pur">{nadhP.toFixed(0)}% NADH</span>
            <span className="physiology-pro2-eng-nadh-pill physiology-pro2-eng-nadh-pill--gr">{t("reoxidationPill", { pct: reoxP.toFixed(0) })}</span>
          </div>
        </div>
        <div className="physiology-pro2-eng-del-chart-card">
          <p className="physiology-pro2-eng-chart-h3 text-emerald-300">{t("deliveryVsUtilization")}</p>
          <div className="physiology-pro2-eng-chart-inner">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 8, right: 12, left: 4, bottom: 32 }}>
                <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} angle={-25} textAnchor="end" height={48} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(0)}`, ""]}
                  contentStyle={chartTooltipStyle("physiology")}
                />
                <Bar dataKey="v" fill={CHART_MODULE_ACCENT.physiology} radius={[6, 6, 0, 0]} name={t("indexTimes100")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="physiology-pro2-eng-maxox-state">
        <Zap className="physiology-pro2-eng-section-ico" aria-hidden />
        <span>{model.state}</span>
      </div>
    </div>
  );
}
