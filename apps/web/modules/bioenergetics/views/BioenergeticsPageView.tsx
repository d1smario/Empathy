"use client";

import { useTranslations } from "next-intl";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { DashboardBioenergeticStrip } from "@/components/dashboard/DashboardBioenergeticStrip";

export default function BioenergeticsPageView() {
  const { signedIn } = useActiveAthlete();
  const t = useTranslations("BioenergeticsPageView");

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-lime-400"
      title={t("title")}
      description={t("description")}
    >
      <Pro2AthleteRequiredGate enabled={signedIn}>
        <DashboardBioenergeticStrip />
      </Pro2AthleteRequiredGate>
    </Pro2ModulePageShell>
  );
}
