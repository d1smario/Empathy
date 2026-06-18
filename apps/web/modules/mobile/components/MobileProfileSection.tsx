"use client";

import { DashboardKpiGrid } from "@/components/dashboard/DashboardKpiGrid";
import type { DashboardKpis } from "@/lib/dashboard/dashboard-scores";

export type MobileProfileSectionProps = {
  kpis: DashboardKpis;
};

export function MobileProfileSection({ kpis }: MobileProfileSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white">Profilo fisiologico</h2>
      <DashboardKpiGrid kpis={kpis} columns={3} />
    </section>
  );
}
