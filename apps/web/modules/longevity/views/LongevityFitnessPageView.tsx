"use client";

import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { DashboardLongevityPanels } from "@/components/dashboard/DashboardLongevityPanels";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";

export default function LongevityFitnessPageView() {
  const { signedIn } = useActiveAthlete();

  return (
    <Pro2ModulePageShell
      eyebrow="Benessere quotidiano"
      eyebrowClassName={moduleEyebrowClass("longevity")}
      title="Longevità"
      description="Fai il check-in di oggi e segui il tuo indice di longevità e fitness."
    >
      <Pro2AthleteRequiredGate enabled={signedIn}>
        <DashboardLongevityPanels />
      </Pro2AthleteRequiredGate>
    </Pro2ModulePageShell>
  );
}
