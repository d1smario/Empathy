"use client";

import { DashboardTwinRadial } from "@/components/dashboard/DashboardTwinRadial";
import type { DashboardArea } from "@/lib/dashboard/dashboard-scores";

export type MobileTwinSectionProps = {
  areas: DashboardArea[];
};

export function MobileTwinSection({ areas }: MobileTwinSectionProps) {
  return (
    <section className="relative -mx-2 overflow-hidden py-2">
      <DashboardTwinRadial areas={areas} badgeSize="sm" />
    </section>
  );
}
