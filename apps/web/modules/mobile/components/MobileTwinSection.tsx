"use client";

import { DashboardTwinRadial } from "@/components/dashboard/DashboardTwinRadial";
import type { DashboardArea } from "@/lib/dashboard/dashboard-scores";

export type MobileTwinSectionProps = {
  areas: DashboardArea[];
};

export function MobileTwinSection({ areas }: MobileTwinSectionProps) {
  return (
    // Niente overflow-hidden: tagliava l'etichetta in alto (es. "Performance").
    // `portrait` dà al twin un contenitore più alto → respiro verticale, niente
    // sovrapposizioni tra le scritte dei badge.
    <section className="relative -mx-2 py-4">
      <DashboardTwinRadial areas={areas} badgeSize="sm" portrait />
    </section>
  );
}
