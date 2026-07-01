"use client";

import type { PowerComponentRow } from "@/lib/engines/critical-power-engine";

export type MetabolicPowerComponentsStackChartProps = {
  rows: PowerComponentRow[];
  /** Motore CP attivo (da `METABOLIC_CP_ENGINE_REVISION`); se assente non mostriamo la riga build. */
  engineRevision?: string;
};

/**
 * Barre impilate: P(t) = CP + W′/t ripartito in ossidativo residuo, PCr (cinetica e⁻ᵗ/ᵗ) e glicolisi (quota iperbolica + parallela a soglia).
 */
export function MetabolicPowerComponentsStackChart({ rows, engineRevision }: MetabolicPowerComponentsStackChartProps) {
  if (!rows.length) return null;

  return (
    <div className="metabolic-comp-stack-card" aria-label="Model power breakdown: oxidative, PCr and glycolytic by duration">
      <div className="metabolic-comp-stack-head">
        <h4 className="metabolic-comp-stack-title">Three metabolic components · power share by duration</h4>
        <p className="metabolic-comp-stack-caption">
          <strong>P(t) = CP + W′/t</strong> with CP/W′ from <strong>work–time</strong> fit when R² is high.{" "}
          <strong style={{ color: "#7dd3fc" }}>PCr</strong>: <strong>P<sub>PCr</sub> = min(W′/t, (E<sub>PCr</sub>/t)·e<sup>−t/τ</sup>)</strong>.{" "}
          <strong style={{ color: "#fbbf24" }}>Glycolysis</strong>: hyperbolic share <strong>W′/t − P<sub>PCr</sub></strong> + threshold-parallel share{" "}
          <strong>CP·f<sub>∥</sub>(t)</strong> (grows with log t). <strong style={{ color: "#34d399" }}>Oxidative</strong> = residual. Not lab V̇La.
        </p>
      </div>
      <div className="metabolic-comp-stack-rows">
        {rows.map((row) => {
          const p = Math.max(1, row.modelPowerW);
          const pctA = (row.aerobicW / p) * 100;
          const pctP = (row.pcrW / p) * 100;
          const pctG = (row.glycolyticW / p) * 100;
          return (
            <div key={row.sec} className="metabolic-comp-stack-row">
              <span className="metabolic-comp-stack-lab">{row.label}</span>
              <div className="metabolic-comp-stack-track" title={`P=${row.modelPowerW.toFixed(0)} W`}>
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--aer"
                  style={{ width: `${pctA}%` }}
                  title={`Oxidative ${row.aerobicW.toFixed(0)} W`}
                />
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--pcr"
                  style={{ width: `${pctP}%` }}
                  title={`PCr ${row.pcrW.toFixed(0)} W`}
                />
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--gly"
                  style={{ width: `${pctG}%` }}
                  title={`Glycolysis ${row.glycolyticW.toFixed(0)} W`}
                />
              </div>
              <span className="metabolic-comp-stack-total">{row.modelPowerW.toFixed(0)} W</span>
            </div>
          );
        })}
      </div>
      <ul className="metabolic-comp-stack-legend">
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--aer" /> Oxidative
        </li>
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--pcr" /> PCr
        </li>
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--gly" /> Glycolysis
        </li>
      </ul>
      {engineRevision ? (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "0.68rem",
            lineHeight: 1.4,
            color: "var(--empathy-text-muted)",
            fontFamily: "ui-monospace, monospace",
            wordBreak: "break-word",
          }}
        >
          Active engine: <strong style={{ color: "var(--empathy-text-secondary)" }}>{engineRevision}</strong>
          {" — "}
          if in production you still see <em>identical</em> PCr/glyc kJ across all durations, the deploy does not include this revision.
        </p>
      ) : null}
    </div>
  );
}
