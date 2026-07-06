"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import type { MaxOxidateOutput } from "@/lib/engines/max-oxidate-engine";
import { MaxOxidateLabPro2Panel } from "@/components/physiology/MaxOxidateLabPro2Panel";
import { MaxOxPro2EngineReport } from "@/components/physiology/MaxOxPro2EngineReport";

export type PhysiologyPro2MaxOxLabProps = {
  model: MaxOxidateOutput;
  reliabilityPct: number;
  uncertaintyPct: number;
  bottleneckLabel: string;
  ratioSummary: string;
  redoxSummary: string;
  /** VO₂ capacità nel modello (curva CP / test / stima potenza). */
  vo2Used: number;
  vo2AtPowerL: number;
  vo2MlKgCapacity: number;
  vo2MlKgAtPower: number;
  vo2CapacitySource: "metabolic_engine_vo2max" | "power_estimate" | "test_manual";
  /** Per caption Max Oxidate: VO₂max da Metabolic Profile (curva CP), se disponibile. */
  vo2maxMlMinKgForCaption?: number | null;
  vo2maxLMinForCaption?: number | null;
  maxOxVo2Mode: "device" | "test";
  /** Report motore + meter tecnici visibili solo a coach/admin. */
  showTech?: boolean;
  children: ReactNode;
};

export function PhysiologyPro2MaxOxLab({
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
  vo2maxMlMinKgForCaption,
  vo2maxLMinForCaption,
  maxOxVo2Mode,
  showTech = false,
  children,
}: PhysiologyPro2MaxOxLabProps) {
  const t = useTranslations("PhysiologyPro2MaxOxLab");
  return (
    <div className="physiology-pro2-lab physiology-pro2-lab--maxox">
      <MaxOxidateLabPro2Panel
        model={model}
        vo2maxMlMinKg={vo2maxMlMinKgForCaption ?? null}
        vo2maxLMin={vo2maxLMinForCaption ?? null}
        maxOxVo2UsedLMin={vo2Used}
        vo2CapacitySource={vo2CapacitySource}
        showTech={showTech}
      />

      {/* Report motore Max Oxidate (VO₂ trio, gauge, KPI gross/net, delivery,
          NADH, reliability/uncertainty, state): solo coach/admin, come il report
          lattato. L'atleta ha la sintesi nel pannello sopra (audit 2026-07). */}
      {showTech ? (
        <MaxOxPro2EngineReport
          model={model}
          reliabilityPct={reliabilityPct}
          uncertaintyPct={uncertaintyPct}
          bottleneckLabel={bottleneckLabel}
          ratioSummary={ratioSummary}
          redoxSummary={redoxSummary}
          vo2Used={vo2Used}
          vo2AtPowerL={vo2AtPowerL}
          vo2MlKgCapacity={vo2MlKgCapacity}
          vo2MlKgAtPower={vo2MlKgAtPower}
          vo2CapacitySource={vo2CapacitySource}
          maxOxVo2Mode={maxOxVo2Mode}
        />
      ) : null}

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--maxox-inputs">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>{t("inputsBanner")}</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-page-stack">{children}</div>
    </div>
  );
}
