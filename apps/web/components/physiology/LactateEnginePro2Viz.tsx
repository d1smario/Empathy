"use client";

import type { LactateEngineOutput } from "@/lib/engines/lactate-engine";

export type LactateEnginePro2VizProps = {
  model: LactateEngineOutput;
  choGapG: number;
};

type Seg = { key: string; label: string; value: number; tone: string };

function pct(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

function SegmentedBar({ segments, unit }: { segments: Seg[]; unit: string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const denom = total > 0 ? total : 1;
  return (
    <div className="lactate-engine-viz-bar-wrap">
      <div
        className="lactate-engine-viz-bar-track"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value.toFixed(1)} ${unit}`).join(", ")}
      >
        {segments.map((seg) => {
          const w = (Math.max(0, seg.value) / denom) * 100;
          if (w < 0.05) return null;
          return (
            <div
              key={seg.key}
              className={`lactate-engine-viz-bar-seg lactate-engine-viz-bar-seg--${seg.tone}`}
              style={{ width: `${w}%` }}
              title={`${seg.label}: ${seg.value.toFixed(2)} ${unit}`}
            />
          );
        })}
      </div>
      <ul className="lactate-engine-viz-legend">
        {segments.map((seg) => (
          <li key={seg.key}>
            <span className={`lactate-engine-viz-dot lactate-engine-viz-dot--${seg.tone}`} />
            <span className="lactate-engine-viz-legend-label">{seg.label}</span>
            <span className="lactate-engine-viz-legend-val">
              {seg.value.toFixed(1)} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeterRow({ label, value01, tone }: { label: string; value01: number; tone: string }) {
  const p = pct(value01 * 100, 100);
  return (
    <div className="lactate-engine-viz-meter">
      <div className="lactate-engine-viz-meter-head">
        <span>{label}</span>
        <span className="lactate-engine-viz-meter-pct">{(value01 * 100).toFixed(0)}%</span>
      </div>
      <div className="lactate-engine-viz-meter-track">
        <div className={`lactate-engine-viz-meter-fill lactate-engine-viz-meter-fill--${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/**
 * Grafica Pro2 per l’output del motore lattato: split energetico, destino lattato, pipeline CHO, indicatori gut.
 * Complementare al report (`LactatePro2EngineReport`) e alla curva LT (`LactateThresholdPro2Panel`).
 */
export function LactateEnginePro2Viz({ model, choGapG }: LactateEnginePro2VizProps) {
  const E = Math.max(1e-6, model.energyDemandKcal);
  const energySegs: Seg[] = [
    { key: "cho", label: "Energy from CHO", value: model.choKcal, tone: "amber" },
    { key: "noncho", label: "Energy from non-CHO", value: model.nonChoKcal, tone: "cyan" },
  ];

  const oxSegs: Seg[] = [
    { key: "aer", label: "Aerobic (VO₂ ceiling)", value: model.aerobicKcal, tone: "cyan" },
    { key: "ana", label: "Anaerobic contribution", value: model.anaerobicKcal, tone: "rose" },
  ];

  const lacSegs: Seg[] = [
    { key: "ox", label: "Oxidized (MCT1)", value: model.lactateOxidizedG, tone: "cyan" },
    { key: "cori", label: "Cori cycle", value: model.lactateCoriG, tone: "violet" },
    { key: "acc", label: "Accumulated", value: model.lactateAccumG, tone: "rose" },
  ];

  const ing = model.choIngestedTotalG;
  const nonAbsorbedG = Math.max(0, ing - model.choAfterAbsorptionG);
  const pipeSegs: Seg[] = [
    { key: "nab", label: "Not absorbed (gut output)", value: nonAbsorbedG, tone: "slate" },
    { key: "seq", label: "Microbiota sequestration", value: model.microbiotaSequestrationG, tone: "rose" },
    { key: "blood", label: "Available pool / blood", value: model.choIntoBloodstreamG, tone: "amber" },
  ];

  const riskTone =
    model.gutPathwayRisk === "high" ? "rose" : model.gutPathwayRisk === "moderate" ? "amber" : "green";

  return (
    <div className="lactate-engine-viz">
      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">Energy balance · substrate split</h4>
        <p className="lactate-engine-viz-sub">
          Total demand <strong>{model.energyDemandKcal.toFixed(0)} kcal</strong> · glycolytic share {model.glycolyticSharePct.toFixed(0)}% · RER implicit in the engine
        </p>
        {model.profileMetabolicCouplingActive ? (
          <p className="lactate-engine-viz-hint" style={{ marginTop: 6 }}>
            CP+W′ profile: anaerobic/lactate modulation (hint {(model.profileAnaerobicModulation01 * 100).toFixed(0)}%) from hyperbolic sustainability and glycolytic proxy.
          </p>
        ) : null}
        <SegmentedBar segments={energySegs} unit="kcal" />
      </div>

      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">Aerobic vs anaerobic (kcal)</h4>
        <p className="lactate-engine-viz-sub">
          Aerobic coverage {pct(model.aerobicKcal, E).toFixed(0)}% · anaerobic contribution {pct(model.anaerobicKcal, E).toFixed(0)}%
        </p>
        <SegmentedBar segments={oxSegs} unit="kcal" />
      </div>

      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">Lactate fate · mass (g)</h4>
        <p className="lactate-engine-viz-sub">
          Produced <strong>{model.lactateProducedG.toFixed(1)} g</strong> (anaerobic {model.lactateFromAnaerobicGlycolysisG.toFixed(1)} · aerobic{" "}
          {model.lactateFromAerobicGlycolysisG.toFixed(1)}) · gross glycogen {model.glycogenCombustedGrossG.toFixed(1)} g
        </p>
        <SegmentedBar segments={lacSegs} unit="g" />
        <p className="lactate-engine-viz-hint">
          Three fates on the product: oxidation {model.lactateFateOxidationPct.toFixed(0)}% · Cori {model.lactateFateCoriPct.toFixed(0)}% · accumulation{" "}
          {model.lactateFateAccumPct.toFixed(0)}%
        </p>
      </div>

      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">CHO pipeline during session (g)</h4>
        <p className="lactate-engine-viz-sub">
          Total ingested <strong>{model.choIngestedTotalG.toFixed(1)} g</strong> · exogenous oxidized {model.exogenousOxidizedG.toFixed(1)} g · strategy CHO gap{" "}
          <strong className={`font-mono tabular-nums ${choGapG > 15 ? "text-rose-400" : choGapG > 5 ? "text-amber-300" : "text-emerald-400"}`}>{choGapG.toFixed(0)} g</strong>
          {model.bloodGlucoseMmolL != null ? (
            <>
              {" "}
              · sensor blood glucose <strong>{model.bloodGlucoseMmolL.toFixed(2)} mmol/L</strong>
            </>
          ) : null}
        </p>
        <SegmentedBar segments={pipeSegs} unit="g" />
        <p className="lactate-engine-viz-hint">
          Gut absorption (CHO through the wall) {model.gutAbsorptionYieldPctOfIngested.toFixed(0)}% of ingested · blood pool entry{" "}
          {model.bloodDeliveryPctOfIngested.toFixed(0)}% of ingested · effective microbiota sequestration {model.effectiveSequestrationPct.toFixed(1)}%
        </p>
        <p className="lactate-engine-viz-hint">
          Mass: absorbed {model.choAfterAbsorptionG.toFixed(1)} g · available in circulation {model.choAvailableG.toFixed(1)} g (post-sequestration)
        </p>
      </div>

      <div className="lactate-engine-viz-card lactate-engine-viz-card--gut">
        <h4 className="lactate-engine-viz-title">Gut · microbiota · pathway risk</h4>
        <p className="lactate-engine-viz-sub">
          Pathway risk: <span className={`lactate-engine-viz-risk lactate-engine-viz-risk--${riskTone}`}>{model.gutPathwayRisk}</span>
        </p>
        <div className="lactate-engine-viz-meter-grid">
          <MeterRow label="Dysbiosis score" value01={model.microbiotaDysbiosisScore} tone="rose" />
          <MeterRow label="Gut stress" value01={model.gutStressScore} tone="amber" />
          <MeterRow label="Fermentation load" value01={model.fermentationLoadScore} tone="violet" />
        </div>
        <div className="lactate-engine-viz-mini-kpis">
          <div>
            <span className="lactate-engine-viz-mini-label">Net glycogen</span>
            <span className="lactate-engine-viz-mini-val">{model.glycogenCombustedNetG.toFixed(1)} g</span>
          </div>
          <div>
            <span className="lactate-engine-viz-mini-label">Glucose required</span>
            <span className="lactate-engine-viz-mini-val">{model.glucoseRequiredForStrategyG.toFixed(1)} g</span>
          </div>
          <div>
            <span className="lactate-engine-viz-mini-label">Glucose from Cori</span>
            <span className="lactate-engine-viz-mini-val">{model.glucoseFromCoriG.toFixed(1)} g</span>
          </div>
          <div>
            <span className="lactate-engine-viz-mini-label">Cori cost</span>
            <span className="lactate-engine-viz-mini-val">{model.coriCostKcal.toFixed(0)} kcal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
