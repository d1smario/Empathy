"use client";

import { BarChart3, CalendarDays, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { MODULE_PILL_FUCHSIA, MODULE_PILL_ROSE, MODULE_PILL_SKY } from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillLinkItem, routeActive } from "@/components/navigation/ModulePillSubnav";
import { useActiveAthlete } from "@/lib/use-active-athlete";

const ITEMS: ModulePillLinkItem[] = [
  {
    key: "calendar",
    href: "/training/calendar",
    label: "Calendario",
    icon: CalendarDays,
    style: MODULE_PILL_SKY,
  },
  {
    key: "builder",
    href: "/training/builder",
    label: "Builder",
    icon: Sparkles,
    style: MODULE_PILL_FUCHSIA,
  },
  {
    key: "analyzer",
    href: "/training/analytics",
    label: "Analyzer",
    icon: BarChart3,
    style: MODULE_PILL_ROSE,
  },
];

/**
 * Nav secondaria training (2026-07): Calendario + Analyzer per tutti; Builder
 * solo per coach/admin (l'atleta non costruisce le sedute). Hub, Virya e
 * «Oggi & Domani» rimossi.
 */
export function TrainingSubnav() {
  const pathname = usePathname();
  const { role, adminScoped } = useActiveAthlete();
  const isCoachOrAdmin = role === "coach" || adminScoped;
  const items = ITEMS.filter((i) => (i.key === "builder" ? isCoachOrAdmin : true));

  return (
    <ModulePillSubnav
      variant="link"
      items={items}
      isActive={(item) =>
        // Il Builder rappresenta l'intero scope di programmazione: resta attivo
        // sia su «Giorno» (/training/builder) sia su «Piano» (/training/vyria).
        item.key === "builder"
          ? routeActive(pathname, "/training/builder") || routeActive(pathname, "/training/vyria")
          : routeActive(pathname, item.href)
      }
      ariaLabel="Sotto-moduli training"
    />
  );
}
