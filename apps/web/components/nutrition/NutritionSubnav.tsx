"use client";

import { CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";
import { MODULE_PILL_AMBER } from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillLinkItem } from "@/components/navigation/ModulePillSubnav";

export const NUTRITION_SUBNAV_PATHS = {
  mealPlan: "/nutrition/meal-plan",
} as const;

/**
 * Nutrition a pagina UNICA (2026-07): il PIANO assorbe Diario, fueling,
 * integratori e previsione — Strumenti eliminato (bioenergetica vive in
 * Physiology). Resta la sola pillola identitaria «Piano», sempre attiva,
 * fusa nella riga del selettore giorno.
 */
export function NutritionSubnav() {
  const t = useTranslations("NutritionSubnav");

  const items: ModulePillLinkItem[] = [
    {
      key: "meal-plan",
      href: NUTRITION_SUBNAV_PATHS.mealPlan,
      label: t("plan"),
      icon: CalendarRange,
      style: MODULE_PILL_AMBER,
    },
  ];

  return (
    <ModulePillSubnav
      variant="link"
      items={items}
      isActive={() => true}
      ariaLabel={t("ariaLabel")}
    />
  );
}
