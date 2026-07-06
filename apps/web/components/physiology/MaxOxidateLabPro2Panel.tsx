"use client";

import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MaxOxidateOutput } from "@/lib/engines/max-oxidate-engine";
import { MaxOxidateEnginePro2Viz } from "@/components/physiology/MaxOxidateEnginePro2Viz";

export type MaxOxidateLabPro2PanelProps = {
  model: MaxOxidateOutput;
  /** VO₂max ml/kg/min da profilo anagrafico/lab, se presente. */
  vo2maxMlMinKg?: number | null;
  /** VO₂max in L/min da Metabolic Profile, se presente. */
  vo2maxLMin?: number | null;
  /** VO₂ (L/min) effettivamente usato come capacità nel motore Max Oxidate. */
  maxOxVo2UsedLMin: number;
  vo2CapacitySource: "metabolic_engine_vo2max" | "power_estimate" | "test_manual";
  /** Meter Delivery/Stress della viz visibili solo a coach/admin. */
  showTech?: boolean;
};

/**
 * Shell Pro2 per il lab Max Oxidate: stessa gerarchia visiva del Lactate Lab (testata, caption, sintesi grafica, nota a piè).
 */
export function MaxOxidateLabPro2Panel({
  model,
  vo2maxMlMinKg,
  vo2maxLMin,
  maxOxVo2UsedLMin,
  vo2CapacitySource,
  showTech = false,
}: MaxOxidateLabPro2PanelProps) {
  const t = useTranslations("MaxOxidateLabPro2Panel");
  const vo2Used = `${maxOxVo2UsedLMin.toFixed(2)} L/min`;
  const bold = (chunks: ReactNode) => <strong>{chunks}</strong>;
  const vo2Block =
    vo2CapacitySource === "test_manual"
      ? t.rich("vo2CapacityManual", { b: bold, vo2: vo2Used })
      : vo2CapacitySource === "metabolic_engine_vo2max"
        ? vo2maxMlMinKg != null
          ? t.rich("vo2maxFromMetabolicWithValue", {
              b: bold,
              value: `${vo2maxMlMinKg.toFixed(1)} ml/kg/min · ${vo2Used}`,
            })
          : t.rich("vo2maxFromMetabolicNoValue", { b: bold, vo2: vo2Used })
        : t.rich("vo2CapacityPowerWarning", { b: bold, vo2: vo2Used });

  return (
    <div className="physiology-pro2-maxox-card" aria-label="Max Oxidate lab Pro 2">
      <div className="physiology-pro2-maxox-head">
        <div className="physiology-pro2-maxox-head-left">
          <div className="physiology-pro2-maxox-head-title-row">
            <div className="physiology-pro2-maxox-ico" aria-hidden>
              <Flame size={20} strokeWidth={1.75} />
            </div>
            <h3 className="physiology-pro2-maxox-title">{t("title")}</h3>
          </div>
          <p className="physiology-pro2-maxox-caption">
            {vo2Block}{" "}
            {t.rich("caption", { b: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>
        <div className="physiology-pro2-maxox-strip">
          {t("oxidativeSaturation")}{" "}
          <span className="physiology-pro2-maxox-strip-value">{model.utilizationRatioPct.toFixed(0)}%</span>
          <span className="physiology-pro2-maxox-strip-unit">{t("bottleneckLabel")}</span>
          <span className="physiology-pro2-maxox-strip-value physiology-pro2-maxox-strip-value--pink">
            {model.oxidativeBottleneckIndex.toFixed(0)}
          </span>
          <span className="physiology-pro2-maxox-strip-unit">/100</span>
        </div>
      </div>

      <div className="physiology-pro2-maxox-viz-wrap">
        <MaxOxidateEnginePro2Viz model={model} showTech={showTech} />
      </div>

      {/* Footnote con `model.version` RIMOSSA (audit 2026-07): stringa di
          revisione motore, nessun valore per l'atleta. */}
    </div>
  );
}
