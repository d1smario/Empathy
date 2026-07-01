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
      eyebrow="Daily wellbeing"
      eyebrowClassName={moduleEyebrowClass("longevity")}
      title="Longevity"
      description="Complete today's check-in and track your longevity and fitness index."
    >
      <Pro2AthleteRequiredGate enabled={signedIn}>
        <DashboardLongevityPanels />
      </Pro2AthleteRequiredGate>
    </Pro2ModulePageShell>
  );
}
