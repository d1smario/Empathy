"use client";

import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { DashboardBioenergeticStrip } from "@/components/dashboard/DashboardBioenergeticStrip";

export default function BioenergeticsPageView() {
  const { signedIn } = useActiveAthlete();

  return (
    <Pro2ModulePageShell
      eyebrow="La tua giornata, ora per ora"
      eyebrowClassName="text-lime-400"
      title="Bioenergetica"
      description="La striscia della giornata di oggi, ora per ora."
    >
      <Pro2AthleteRequiredGate enabled={signedIn}>
        <DashboardBioenergeticStrip />
      </Pro2AthleteRequiredGate>
    </Pro2ModulePageShell>
  );
}
