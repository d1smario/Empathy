"use client";

import { useTranslations } from "next-intl";

export type ViryaAnnualLoadProjectionCardProps = {
  annualLoad: number[];
  maxAnnual: number;
};

export function ViryaAnnualLoadProjectionCard({
  annualLoad,
  maxAnnual,
}: ViryaAnnualLoadProjectionCardProps) {
  const t = useTranslations("ViryaAnnualLoadProjectionCard");
  return (
        <article className="viz-card builder-panel">
          <h3 className="viz-title">Annual Load Projection</h3>
          <div className="annual-grid">
            {annualLoad.map((tss, idx) => {
              const intensity = tss / maxAnnual;
              const bg =
                intensity > 0.78
                  ? "rgba(251,191,36,0.85)"
                  : intensity > 0.55
                    ? "rgba(255,106,0,0.8)"
                    : intensity > 0.3
                      ? "rgba(4,190,129,0.65)"
                      : intensity > 0
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(255,255,255,0.06)";
              return <div key={idx} className="annual-cell" style={{ background: bg }} title={`Week ${idx + 1} · TSS ${tss}`} />;
            })}
          </div>
          <div className="builder-zone-legend" style={{ marginTop: "10px" }}>
            <span className="builder-zone-chip" style={{ borderColor: "#00e08d", color: "#00e08d", backgroundColor: "#00e08d22" }}>Low</span>
            <span className="builder-zone-chip" style={{ borderColor: "#ffd60a", color: "#ffd60a", backgroundColor: "#ffd60a22" }}>Medium</span>
            <span className="builder-zone-chip" style={{ borderColor: "#ff9e00", color: "#ff9e00", backgroundColor: "#ff9e0022" }}>High</span>
            <span className="builder-zone-chip" style={{ borderColor: "#ff00a8", color: "#ff00a8", backgroundColor: "#ff00a822" }}>Peak</span>
          </div>
          <p style={{ marginTop: "10px", color: "var(--empathy-text-muted)", fontSize: "12px" }}>
            {t("dynamicLoopNote")}
          </p>
        </article>
  );
}
