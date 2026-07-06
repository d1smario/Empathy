"use client";

import { useTranslations } from "next-intl";

import type { PowerComponentRow } from "@/lib/engines/critical-power-engine";

export type MetabolicPowerComponentsStackChartProps = {
  rows: PowerComponentRow[];
};

/**
 * Barre impilate: P(t) = CP + W′/t ripartito in ossidativo residuo, PCr (cinetica e⁻ᵗ/ᵗ) e glicolisi (quota iperbolica + parallela a soglia).
 */
export function MetabolicPowerComponentsStackChart({ rows }: MetabolicPowerComponentsStackChartProps) {
  const t = useTranslations("MetabolicPowerComponentsStackChart");
  if (!rows.length) return null;

  return (
    <div className="metabolic-comp-stack-card" aria-label={t("cardAriaLabel")}>
      <div className="metabolic-comp-stack-head">
        <h4 className="metabolic-comp-stack-title">{t("title")}</h4>
        <p className="metabolic-comp-stack-caption">
          {t.rich("caption", {
            strong: (chunks) => <strong>{chunks}</strong>,
            pcr: (chunks) => <strong style={{ color: "#7dd3fc" }}>{chunks}</strong>,
            gly: (chunks) => <strong style={{ color: "#fbbf24" }}>{chunks}</strong>,
            oxy: (chunks) => <strong style={{ color: "#34d399" }}>{chunks}</strong>,
            sub: (chunks) => <sub>{chunks}</sub>,
            sup: (chunks) => <sup>{chunks}</sup>,
          })}
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
              <div className="metabolic-comp-stack-track" title={t("trackTitle", { w: row.modelPowerW.toFixed(0) })}>
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--aer"
                  style={{ width: `${pctA}%` }}
                  title={t("oxidativeTitle", { w: row.aerobicW.toFixed(0) })}
                />
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--pcr"
                  style={{ width: `${pctP}%` }}
                  title={t("pcrTitle", { w: row.pcrW.toFixed(0) })}
                />
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--gly"
                  style={{ width: `${pctG}%` }}
                  title={t("glycolysisTitle", { w: row.glycolyticW.toFixed(0) })}
                />
              </div>
              <span className="metabolic-comp-stack-total">{row.modelPowerW.toFixed(0)} W</span>
            </div>
          );
        })}
      </div>
      <ul className="metabolic-comp-stack-legend">
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--aer" /> {t("legendOxidative")}
        </li>
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--pcr" /> {t("legendPcr")}
        </li>
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--gly" /> {t("legendGlycolysis")}
        </li>
      </ul>
    </div>
  );
}
