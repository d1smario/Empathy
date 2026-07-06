"use client";

import { useTranslations } from "next-intl";

import type { MaxOxidateOutput } from "@/lib/engines/max-oxidate-engine";

type Seg = { key: string; label: string; value: number; tone: string };

function SegmentedBar({ segments, unit }: { segments: Seg[]; unit: string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const denom = total > 0 ? total : 1;
  return (
    <div className="maxox-engine-viz-bar-wrap">
      <div
        className="maxox-engine-viz-bar-track"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value.toFixed(2)} ${unit}`).join(", ")}
      >
        {segments.map((seg) => {
          const w = (Math.max(0, seg.value) / denom) * 100;
          if (w < 0.05) return null;
          return (
            <div
              key={seg.key}
              className={`maxox-engine-viz-bar-seg maxox-engine-viz-bar-seg--${seg.tone}`}
              style={{ width: `${w}%` }}
              title={`${seg.label}: ${seg.value.toFixed(2)} ${unit}`}
            />
          );
        })}
      </div>
      <ul className="maxox-engine-viz-legend">
        {segments.map((seg) => (
          <li key={seg.key}>
            <span className={`maxox-engine-viz-dot maxox-engine-viz-dot--${seg.tone}`} />
            <span className="maxox-engine-viz-legend-label">{seg.label}</span>
            <span className="maxox-engine-viz-legend-val">
              {seg.value.toFixed(2)} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeterRow({ label, value01, tone }: { label: string; value01: number; tone: string }) {
  const p = Math.min(100, Math.max(0, value01 * 100));
  return (
    <div className="maxox-engine-viz-meter">
      <div className="maxox-engine-viz-meter-head">
        <span>{label}</span>
        <span className="maxox-engine-viz-meter-pct">{p.toFixed(0)}%</span>
      </div>
      <div className="maxox-engine-viz-meter-track">
        <div className={`maxox-engine-viz-meter-fill maxox-engine-viz-meter-fill--${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/** Vista grafica Pro2 per l’output Max Oxidate (capacità, substrati, delivery, stress). */
export function MaxOxidateEnginePro2Viz({ model, showTech = false }: { model: MaxOxidateOutput; showTech?: boolean }) {
  const t = useTranslations("MaxOxidateEnginePro2Viz");
  const cap = Math.max(1e-6, model.oxidativeCapacityKcalMin);
  const reqOx = Math.max(0, model.oxidativeDemandKcalMin);
  const headroom = Math.max(0, cap - reqOx);
  const fluxSegs: Seg[] = [
    { key: "req", label: t("oxidativeDemandLabel"), value: reqOx, tone: "rose" },
    { key: "head", label: t("capacityHeadroomLabel"), value: headroom, tone: "cyan" },
  ];

  const cho = Math.max(0, model.oxidativeCapacityChoGMin);
  const fat = Math.max(0, model.oxidativeCapacityFatGMin);
  const subSegs: Seg[] = [
    { key: "cho", label: t("oxidizableChoFluxLabel"), value: cho, tone: "amber" },
    { key: "fat", label: t("oxidizableFatFluxLabel"), value: fat, tone: "slate" },
  ];

  const cDel = Math.min(1, Math.max(0, model.centralDeliveryIndex / 1.2));
  const pUti = Math.min(1, Math.max(0, model.peripheralUtilizationIndex / 1.15));

  return (
    <div className="maxox-engine-viz">
      <div className="maxox-engine-viz-card">
        <h4 className="maxox-engine-viz-title">{t("capacityVsDemandTitle")}</h4>
        <p className="maxox-engine-viz-sub">
          {t.rich("capacityVsDemandSub", {
            capacity: model.oxidativeCapacityKcalMin.toFixed(2),
            saturation: model.utilizationRatioPct.toFixed(0),
            demand: model.requiredKcalMin.toFixed(2),
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <SegmentedBar segments={fluxSegs} unit="kcal/min" />
      </div>

      <div className="maxox-engine-viz-card">
        <h4 className="maxox-engine-viz-title">{t("substratesTitle")}</h4>
        <p className="maxox-engine-viz-sub">{t("substratesSub")}</p>
        <SegmentedBar segments={subSegs} unit="g/min" />
      </div>

      {/* Meter Delivery/Stress = indici motore (central delivery, redox, NADH,
          bottleneckType, state): solo coach/admin (audit 2026-07). L'atleta ha
          già Capacità-vs-Domanda e Substrati sopra. */}
      {showTech ? (
        <>
          <div className="maxox-engine-viz-card maxox-engine-viz-card--wide">
            <h4 className="maxox-engine-viz-title">{t("deliveryTitle")}</h4>
            <div className="maxox-engine-viz-meter-grid">
              <MeterRow label={t("centralDeliveryIndexLabel")} value01={cDel} tone="cyan" />
              <MeterRow label={t("peripheralUtilizationIndexLabel")} value01={pUti} tone="rose" />
              <MeterRow label={t("smo2ExtractionLabel")} value01={model.extractionPct / 85} tone="violet" />
            </div>
            <p className="maxox-engine-viz-hint">
              {t.rich("deliveryHint", {
                vo2rel: model.vo2RelMlKgMin.toFixed(1),
                power: model.oxidativePowerKw.toFixed(3),
                b: (chunks) => <strong>{chunks}</strong>,
                state: () => <span className="maxox-engine-viz-state">{model.state}</span>,
              })}
            </p>
          </div>

          <div className="maxox-engine-viz-card maxox-engine-viz-card--wide">
            <h4 className="maxox-engine-viz-title">{t("stressTitle")}</h4>
            <div className="maxox-engine-viz-meter-grid">
              <MeterRow label={t("bottleneckLabel")} value01={model.oxidativeBottleneckIndex / 100} tone="rose" />
              <MeterRow label={t("redoxStressLabel")} value01={model.redoxStressIndex / 100} tone="amber" />
              <MeterRow label={t("nadhPressureLabel")} value01={model.nadhPressureIndex} tone="violet" />
            </div>
            <p className="maxox-engine-viz-hint">
              {t.rich("stressHint", {
                reox: (model.reoxidationCapacityIndex * 100).toFixed(0),
                b: (chunks) => <strong>{chunks}</strong>,
                type: () => <strong>{model.bottleneckType.replaceAll("_", " ")}</strong>,
              })}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
