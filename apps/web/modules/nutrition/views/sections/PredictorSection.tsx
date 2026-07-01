"use client";

import type { Dispatch, SetStateAction } from "react";
import { SPORTS, n, round } from "@/lib/nutrition/nutrition-view-helpers";

/**
 * Sezione "Predictor" di NutritionPageView (decomposizione del God-component,
 * fetta pilota). Render puro: riceve lo stato manuale (sport/distanza/tempo/
 * intensità/usa-giorno) + i suoi setter dal padre, e le derive già calcolate
 * (predictor, predictorOpsCards, contesto sessione) come props read-only.
 * Lo stato e il compute restano nel padre — qui solo presentazione.
 */
export type PredictorSectionProps = {
  predictorSport: string;
  setPredictorSport: Dispatch<SetStateAction<string>>;
  predictorDistanceKm: number;
  setPredictorDistanceKm: Dispatch<SetStateAction<number>>;
  predictorTimeMin: number;
  setPredictorTimeMin: Dispatch<SetStateAction<number>>;
  predictorIntensityPctFtp: number;
  setPredictorIntensityPctFtp: Dispatch<SetStateAction<number>>;
  predictorUsePlanDay: boolean;
  setPredictorUsePlanDay: Dispatch<SetStateAction<boolean>>;
  predictor: {
    totalEnergy: number;
    fuelingTotal: number;
    exhaustionHours: number;
    eventHours: number;
    maxSustainablePct: number;
  };
  predictorOpsCards: { label: string; value: string; unit: string; sub: string; tone: string }[];
  effectiveSessionDurationMin: number;
  effectiveSessionIntensityPctFtp: number;
  selectedPlanDateShort: string;
  resolvedFuelingTierBand: string;
};

export function PredictorSection({
  predictorSport,
  setPredictorSport,
  predictorDistanceKm,
  setPredictorDistanceKm,
  predictorTimeMin,
  setPredictorTimeMin,
  predictorIntensityPctFtp,
  setPredictorIntensityPctFtp,
  predictorUsePlanDay,
  setPredictorUsePlanDay,
  predictor,
  predictorOpsCards,
  effectiveSessionDurationMin,
  effectiveSessionIntensityPctFtp,
  selectedPlanDateShort,
  resolvedFuelingTierBand,
}: PredictorSectionProps) {
  return (
    <section id="nutrition-predictor" className="scroll-mt-28 mb-10 space-y-4">
      <header className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <h2 className="text-lg font-bold text-white">Prediction</h2>
        <p className="mt-1 text-sm text-gray-400">Estimate energy expenditure, CHO and glycogen depletion risk.</p>
      </header>
      <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
        <h3 className="viz-title">Performance prediction · consumption and energy depletion risk</h3>
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold transition-colors ${
              predictorUsePlanDay
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400/50 hover:bg-amber-500/20"
                : "border-white/15 bg-white/5 text-gray-300 hover:border-amber-400/50 hover:bg-amber-500/10"
            }`}
            onClick={() => setPredictorUsePlanDay((v) => !v)}
          >
            {predictorUsePlanDay ? "Active day context" : "Manual mode"}
          </button>
          {predictorUsePlanDay && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[0.7rem] font-semibold tabular-nums text-amber-300">
              {selectedPlanDateShort} · {round(effectiveSessionDurationMin)} min · {round(effectiveSessionIntensityPctFtp)}% FTP
            </span>
          )}
        </div>
        <div className="form-grid-two">
          <div className="form-group">
            <label className="form-label">Sport</label>
            <select className="form-select" value={predictorSport} onChange={(e) => setPredictorSport(e.target.value)}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Distance (km)</label><input className="form-input" type="number" value={predictorDistanceKm} onChange={(e) => setPredictorDistanceKm(n(e.target.value, 0))} /></div>
          <div className="form-group">
            <label className="form-label">Expected time (min)</label>
            <input
              className="form-input"
              type="number"
              value={predictorUsePlanDay ? round(effectiveSessionDurationMin) : predictorTimeMin}
              disabled={predictorUsePlanDay}
              onChange={(e) => setPredictorTimeMin(n(e.target.value, 0))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Intensity % FTP</label>
            <input
              className="form-input"
              type="number"
              value={predictorUsePlanDay ? round(effectiveSessionIntensityPctFtp) : predictorIntensityPctFtp}
              disabled={predictorUsePlanDay}
              onChange={(e) => setPredictorIntensityPctFtp(n(e.target.value, 0))}
            />
          </div>
        </div>
        <div className="fueling-main-kpi-grid" style={{ marginBottom: "10px" }}>
          {predictorOpsCards.map((card) => (
            <div key={card.label} className={`fueling-main-kpi-card fueling-main-kpi-card--${card.tone}`}>
              <div className="fueling-main-kpi-label">{card.label}</div>
              <div className="fueling-main-kpi-value font-mono tabular-nums">
                {card.value}
                {card.unit ? <span>{card.unit}</span> : null}
              </div>
              <div className="fueling-main-kpi-sub">{card.sub}</div>
            </div>
          ))}
        </div>
        <details className="collapsible-card">
          <summary>Prediction notes</summary>
          <div className="alert-warning" style={{ marginBottom: 0 }}>
            Event energy: {round(predictor.totalEnergy)} kcal · Suggested total fueling: {round(predictor.fuelingTotal)} g CHO · tier {resolvedFuelingTierBand}.
            {predictor.exhaustionHours < predictor.eventHours
              ? ` Depletion risk before the finish: lower your pace toward ${predictor.maxSustainablePct}% FTP or increase fueling.`
              : " Sustainable pace with the configured fueling."}
          </div>
        </details>
      </section>
    </section>
  );
}
