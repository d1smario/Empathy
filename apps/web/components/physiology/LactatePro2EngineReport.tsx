"use client";

import { AlertCircle, CheckCircle2, Droplets, Flame, HeartPulse, Target, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LactateEngineOutput } from "@/lib/engines/lactate-engine";
import {
  CHART_AXIS,
  CHART_FONT,
  CHART_GRID,
  CHART_SIGNAL,
  chartTooltipStyle,
} from "@/lib/ui/chart-theme";

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

type GradientKpi = {
  label: string;
  value: string;
  unit: string;
  gradient: string;
  borderGlow: string;
  Icon: typeof Flame;
};

function Pro2DonutPair({
  title,
  aLabel,
  bLabel,
  aVal,
  bVal,
  aColor,
  bColor,
}: {
  title: string;
  aLabel: string;
  bLabel: string;
  aVal: number;
  bVal: number;
  aColor: string;
  bColor: string;
}) {
  const va = Math.max(0, aVal);
  const vb = Math.max(0, bVal);
  const data = [
    { name: "a", value: va, fill: aColor },
    { name: "b", value: vb, fill: bColor },
  ];

  return (
    <div className="physiology-pro2-eng-donut-card">
      <p className="physiology-pro2-eng-donut-title">{title}</p>
      <div className="physiology-pro2-eng-donut-svg-wrap">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="75%"
              startAngle={180}
              endAngle={0}
              innerRadius={52}
              outerRadius={72}
              stroke="none"
            >
              {data.map((e) => (
                <Cell key={e.name} fill={e.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(0)}`, ""]}
              contentStyle={chartTooltipStyle("physiology")}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="physiology-pro2-eng-donut-legend">
        <span style={{ color: aColor }}>
          <strong>{Math.round(va)}</strong> {aLabel}
        </span>
        <span style={{ color: bColor }}>
          <strong>{Math.round(vb)}</strong> {bLabel}
        </span>
      </div>
    </div>
  );
}

function GradientKpiCard({ item }: { item: GradientKpi }) {
  const Ico = item.Icon;
  return (
    <div
      className="physiology-pro2-eng-kpi"
      style={{
        background: "linear-gradient(145deg, #059669, #047857)",
        boxShadow: "0 8px 32px rgba(16,185,129,0.22)",
      }}
    >
      <div className="physiology-pro2-eng-kpi-head">
        <span className="physiology-pro2-eng-kpi-label">{item.label}</span>
        <Ico className="physiology-pro2-eng-kpi-ico" aria-hidden />
      </div>
      <div className="physiology-pro2-eng-kpi-value">{item.value}</div>
      <div className="physiology-pro2-eng-kpi-unit">{item.unit}</div>
    </div>
  );
}

export function LactatePro2EngineReport({
  model,
  vo2Used,
  rerUsed,
}: {
  model: LactateEngineOutput;
  vo2Used: number;
  rerUsed: number;
}) {
  const t = useTranslations("LactatePro2EngineReport");
  const choKcal = model.choKcal;
  const nonChoKcal = model.nonChoKcal;

  const aer = model.aerobicKcal;
  const ana = model.anaerobicKcal;

  const flowRows = [
    { name: t("flowProduced"), g: model.lactateProducedG, fill: CHART_SIGNAL.hr },
    { name: t("flowOxidized"), g: model.lactateOxidizedG, fill: CHART_SIGNAL.hrv },
    { name: t("flowCori"), g: model.lactateCoriG, fill: CHART_SIGNAL.fat },
    { name: t("flowAccumulated"), g: model.lactateAccumG, fill: CHART_SIGNAL.power },
  ];

  const choPipeline = [
    { label: t("pipelineIngested"), g: model.choIngestedTotalG },
    { label: t("pipelinePostAbsorption"), g: model.choAfterAbsorptionG },
    { label: t("pipelineAvailable"), g: model.choIntoBloodstreamG },
    { label: t("pipelineOxidized"), g: model.exogenousOxidizedG },
  ];
  const pipeMax = Math.max(1, ...choPipeline.map((p) => p.g));

  const shuttleCards: {
    label: string;
    value: string;
    unit: string;
    gradient: string;
    glow: string;
    Icon: typeof Flame;
  }[] = [
    {
      label: t("shuttleGlycogenGross"),
      value: model.glycogenCombustedGrossG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #db2777, #be185d)",
      glow: "0 0 28px rgba(219,39,119,0.35)",
      Icon: Flame,
    },
    {
      label: t("shuttleLactateProduced"),
      value: model.lactateProducedG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #dc2626, #991b1b)",
      glow: "0 0 28px rgba(220,38,38,0.35)",
      Icon: Zap,
    },
    {
      label: t("shuttleLactateAnaerobic"),
      value: model.lactateFromAnaerobicGlycolysisG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #b91c1c, #7f1d1d)",
      glow: "0 0 28px rgba(185,28,28,0.35)",
      Icon: Flame,
    },
    {
      label: t("shuttleLactateAerobic"),
      value: model.lactateFromAerobicGlycolysisG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #9f1239, #831843)",
      glow: "0 0 28px rgba(159,18,57,0.35)",
      Icon: Zap,
    },
    {
      label: t("shuttleFates"),
      value: `${model.lactateFateOxidationPct.toFixed(0)} · ${model.lactateFateCoriPct.toFixed(0)} · ${model.lactateFateAccumPct.toFixed(0)}`,
      unit: "%",
      gradient: "linear-gradient(145deg, #64748b, #475569)",
      glow: "0 0 28px rgba(100,116,139,0.35)",
      Icon: Target,
    },
    {
      label: t("shuttleLactateOxidized"),
      value: model.lactateOxidizedG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #16a34a, #15803d)",
      glow: "0 0 28px rgba(22,163,74,0.35)",
      Icon: CheckCircle2,
    },
    {
      label: t("shuttleLactateCori"),
      value: model.lactateCoriG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #2563eb, #1d4ed8)",
      glow: "0 0 28px rgba(37,99,235,0.35)",
      Icon: HeartPulse,
    },
    {
      label: t("shuttleLactateAccumulated"),
      value: model.lactateAccumG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #ea580c, #c2410c)",
      glow: "0 0 28px rgba(234,88,12,0.35)",
      Icon: AlertCircle,
    },
    {
      label: t("shuttleGlucoseFromCori"),
      value: model.glucoseFromCoriG.toFixed(1),
      unit: "g",
      gradient: "linear-gradient(145deg, #0ea5e9, #0369a1)",
      glow: "0 0 28px rgba(14,165,233,0.35)",
      Icon: Droplets,
    },
    {
      label: t("shuttleCoriCost"),
      value: model.coriCostKcal.toFixed(0),
      unit: "kcal",
      gradient: "linear-gradient(145deg, #f97316, #ea580c)",
      glow: "0 0 28px rgba(249,115,22,0.35)",
      Icon: Flame,
    },
  ];

  const energyKpis: GradientKpi[] = [
    {
      label: t("energyDemand"),
      value: model.energyDemandKcal.toFixed(0),
      unit: "kcal",
      gradient: "linear-gradient(145deg, #ef4444, #f97316)",
      borderGlow: "0 8px 32px rgba(239,68,68,0.25)",
      Icon: Flame,
    },
    {
      label: t("intensity"),
      value: model.intensityPctFtp.toFixed(0),
      unit: "%FTP",
      gradient: "linear-gradient(145deg, #f59e0b, #eab308)",
      borderGlow: "0 8px 32px rgba(245,158,11,0.25)",
      Icon: Zap,
    },
    {
      label: t("vo2Used"),
      value: vo2Used.toFixed(2),
      unit: "L/min",
      gradient: "linear-gradient(145deg, #0ea5e9, #38bdf8)",
      borderGlow: "0 8px 32px rgba(14,165,233,0.25)",
      Icon: HeartPulse,
    },
    {
      label: t("rerUsed"),
      value: rerUsed.toFixed(2),
      unit: "",
      gradient: "linear-gradient(145deg, #d946ef, #a855f7)",
      borderGlow: "0 8px 32px rgba(217,70,239,0.25)",
      Icon: Target,
    },
    {
      label: t("choShare"),
      value: model.glycolyticSharePct.toFixed(0),
      unit: "%",
      gradient: "linear-gradient(145deg, #1d4ed8, #3b82f6)",
      borderGlow: "0 8px 32px rgba(59,130,246,0.25)",
      Icon: Droplets,
    },
    {
      label: t("aerobicEnergy"),
      value: model.aerobicKcal.toFixed(0),
      unit: "kcal (capped)",
      gradient: "linear-gradient(145deg, #22c55e, #14b8a6)",
      borderGlow: "0 8px 32px rgba(34,197,94,0.25)",
      Icon: CheckCircle2,
    },
  ];

  const dysbiosisPct = model.microbiotaDysbiosisScore * 100;
  const gutStressPct = model.gutStressScore * 100;
  const fermentPct = model.fermentationLoadScore * 100;

  const pathwayPill =
    model.gutPathwayRisk === "low"
      ? { text: t("pathwayLow"), className: "physiology-pro2-eng-pathway--low" }
      : model.gutPathwayRisk === "moderate"
        ? { text: t("pathwayModerate"), className: "physiology-pro2-eng-pathway--mod" }
        : { text: t("pathwayHigh"), className: "physiology-pro2-eng-pathway--high" };

  return (
    <div className="physiology-pro2-eng-report">
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-metabolism">
        <Flame className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>{t("bannerTitle")}</span>
        <Flame className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-eng-section physiology-pro2-eng-section--energy">
        <p className="physiology-pro2-eng-section-title physiology-pro2-eng-section-title--pink">
          <Flame className="physiology-pro2-eng-section-ico" aria-hidden />
          {t("sectionEnergyTitle")}
        </p>
        <div className="physiology-pro2-eng-kpi-grid-6">
          {energyKpis.map((k) => (
            <GradientKpiCard key={k.label} item={k} />
          ))}
        </div>
      </div>

      <div className="physiology-pro2-eng-donut-row">
        <Pro2DonutPair
          title={t("donutEnergySubstratesTitle")}
          aLabel={t("donutKcalFromCho")}
          bLabel={t("donutKcalFromNonCho")}
          aVal={choKcal}
          bVal={nonChoKcal}
          aColor="#3b82f6"
          bColor="#facc15"
        />
        <Pro2DonutPair
          title={t("donutAerobicVsAnaerobicTitle")}
          aLabel={t("donutAerobicKcal")}
          bLabel={t("donutAnaerobicKcal")}
          aVal={aer}
          bVal={ana}
          aColor="#22c55e"
          bColor="#ef4444"
        />
      </div>

      <div className="physiology-pro2-eng-chart-block physiology-pro2-eng-chart-block--lac-flow">
        <h3 className="physiology-pro2-eng-chart-h3 text-emerald-300">{t("lactateFlowTitle")}</h3>
        <p className="physiology-pro2-eng-chart-caption">
          {t("lactateFlowCaption", {
            ox: model.lactateFateOxidationPct.toFixed(0),
            cori: model.lactateFateCoriPct.toFixed(0),
            acc: model.lactateFateAccumPct.toFixed(0),
          })}
        </p>
        <div className="physiology-pro2-eng-chart-inner">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={flowRows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} label={{ value: "g", angle: -90, position: "insideLeft", fill: CHART_AXIS.label, fontSize: CHART_FONT.axisLabel }} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={chartTooltipStyle("physiology")}
                formatter={(v: number) => [`${v.toFixed(1)} g`, ""]}
              />
              <Bar dataKey="g" radius={[8, 8, 0, 0]}>
                {flowRows.map((e) => (
                  <Cell key={e.name} fill={e.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="physiology-pro2-eng-section">
        <p className="physiology-pro2-eng-section-title physiology-pro2-eng-section-title--magenta">
          <Droplets className="physiology-pro2-eng-section-ico" aria-hidden />
          {t("sectionGlycogenTitle")}
        </p>
        <div className="physiology-pro2-eng-shuttle-grid">
          {shuttleCards.map((c) => {
            const Ico = c.Icon;
            return (
              <div
                key={c.label}
                className="physiology-pro2-eng-shuttle-card"
                style={{ background: c.gradient, boxShadow: `0 0 24px ${c.glow}` }}
              >
                <div className="physiology-pro2-eng-shuttle-head">
                  <span>{c.label.toUpperCase()}</span>
                  <Ico className="physiology-pro2-eng-shuttle-ico" aria-hidden />
                </div>
                <div className="physiology-pro2-eng-shuttle-value">{c.value}</div>
                <div className="physiology-pro2-eng-shuttle-unit">{c.unit}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="physiology-pro2-eng-two-col">
        <div className="physiology-pro2-eng-pipeline-card">
          <h3 className="physiology-pro2-eng-chart-h3 text-emerald-300">{t("choPipelineTitle")}</h3>
          <div className="physiology-pro2-eng-pipeline-bars">
            {choPipeline.map((row) => (
              <div key={row.label} className="physiology-pro2-eng-pipeline-row">
                <div className="physiology-pro2-eng-pipeline-label">{row.label}</div>
                <div className="physiology-pro2-lab-bar-track">
                  <div
                    className="physiology-pro2-lab-bar"
                    style={{ width: `${(row.g / pipeMax) * 100}%`, background: "linear-gradient(90deg,#38bdf8,#2563eb)" }}
                  />
                </div>
                <div className="physiology-pro2-eng-pipeline-val">{row.g.toFixed(1)} g</div>
              </div>
            ))}
          </div>
          <p className="physiology-pro2-eng-pipeline-footnote">
            {t.rich("pipelineFootnote", {
              absorption: model.gutAbsorptionYieldPctOfIngested.toFixed(1),
              blood: model.bloodDeliveryPctOfIngested.toFixed(0),
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>

        <div className="physiology-pro2-eng-micro-card">
          <h3 className="physiology-pro2-eng-chart-h3 text-emerald-300">{t("microbiotaTitle")}</h3>
          <ul className="physiology-pro2-eng-micro-list">
            <li>
              <span>{t("microAbsorptionVsIngested")}</span>
              <span>{model.gutAbsorptionYieldPctOfIngested.toFixed(1)}%</span>
              <div className="physiology-pro2-lab-bar-track">
                <div
                  className="physiology-pro2-lab-bar"
                  style={{ width: `${clampPct(model.gutAbsorptionYieldPctOfIngested)}%`, background: "#38bdf8" }}
                />
              </div>
            </li>
            <li>
              <span>{t("microBloodDelivery")}</span>
              <span>{model.bloodDeliveryPctOfIngested.toFixed(0)}%</span>
              <div className="physiology-pro2-lab-bar-track">
                <div
                  className="physiology-pro2-lab-bar"
                  style={{ width: `${clampPct(model.bloodDeliveryPctOfIngested)}%`, background: "#22c55e" }}
                />
              </div>
            </li>
            <li>
              <span>{t("microEffectiveSequestration")}</span>
              <span>{model.effectiveSequestrationPct.toFixed(0)}%</span>
              <div className="physiology-pro2-lab-bar-track">
                <div
                  className="physiology-pro2-lab-bar"
                  style={{ width: `${clampPct(model.effectiveSequestrationPct)}%`, background: "#fb923c" }}
                />
              </div>
            </li>
            <li>
              <span>{t("microDysbiosisScore")}</span>
              <span>{dysbiosisPct.toFixed(0)}%</span>
              <div className="physiology-pro2-lab-bar-track">
                <div
                  className="physiology-pro2-lab-bar"
                  style={{ width: `${clampPct(dysbiosisPct)}%`, background: "#ec4899" }}
                />
              </div>
            </li>
            <li>
              <span>{t("microGutStress")}</span>
              <span>{gutStressPct.toFixed(0)}%</span>
              <div className="physiology-pro2-lab-bar-track">
                <div
                  className="physiology-pro2-lab-bar"
                  style={{ width: `${clampPct(gutStressPct)}%`, background: "#64748b" }}
                />
              </div>
            </li>
            <li>
              <span>{t("microFermentationLoad")}</span>
              <span>{fermentPct.toFixed(0)}%</span>
              <div className="physiology-pro2-lab-bar-track">
                <div
                  className="physiology-pro2-lab-bar"
                  style={{ width: `${clampPct(fermentPct)}%`, background: "#eab308" }}
                />
              </div>
            </li>
          </ul>
          <div className="physiology-pro2-eng-pathway-box">
            <span className="physiology-pro2-eng-pathway-label">{t("pathwayRiskLabel")}</span>
            <span className={`physiology-pro2-eng-pathway-pill ${pathwayPill.className}`}>{pathwayPill.text}</span>
          </div>
        </div>
      </div>

      <div className="physiology-pro2-eng-strategia">
        <p className="physiology-pro2-eng-section-title physiology-pro2-eng-section-title--strat">
          <Target className="physiology-pro2-eng-section-ico" aria-hidden />
          {t("sectionStrategyTitle")}
        </p>
        <div className="physiology-pro2-eng-strategia-kpis">
          <div className="physiology-pro2-eng-strat-kpi physiology-pro2-eng-strat-kpi--purple">
            <span className="physiology-pro2-eng-strat-label">{t("stratGlycogenNet")}</span>
            <strong>{model.glycogenCombustedNetG.toFixed(1)}</strong>
            <span className="physiology-pro2-eng-strat-unit">{t("stratUnitGrams")}</span>
          </div>
          <div className="physiology-pro2-eng-strat-kpi physiology-pro2-eng-strat-kpi--orange">
            <span className="physiology-pro2-eng-strat-label">{t("stratGlucoseRequired")}</span>
            <strong>{model.glucoseRequiredForStrategyG.toFixed(1)}</strong>
            <span className="physiology-pro2-eng-strat-unit">{t("stratUnitGrams")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
