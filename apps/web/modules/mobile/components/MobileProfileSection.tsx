"use client";

import { useTranslations } from "next-intl";

import { DashboardKpiGrid } from "@/components/dashboard/DashboardKpiGrid";
import type { DashboardKpis } from "@/lib/dashboard/dashboard-scores";

export type MobileProfileSectionProps = {
  kpis: DashboardKpis;
};

export function MobileProfileSection({ kpis }: MobileProfileSectionProps) {
  const t = useTranslations("MobileProfileSection");
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white">{t("physiologicalProfileTitle")}</h2>
      <DashboardKpiGrid kpis={kpis} columns={3} />
    </section>
  );
}
