"use client";

import { useTranslations } from "next-intl";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { DashboardLongevityPanels } from "@/components/dashboard/DashboardLongevityPanels";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";

export default function LongevityFitnessPageView() {
  const { signedIn } = useActiveAthlete();
  const t = useTranslations("LongevityFitnessPageView");

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName={moduleEyebrowClass("longevity")}
      title={t("title")}
      description={t("description")}
    >
      <Pro2AthleteRequiredGate enabled={signedIn}>
        <DashboardLongevityPanels />
      </Pro2AthleteRequiredGate>
    </Pro2ModulePageShell>
  );
}
