"use client";

import { CalendarRange, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MODULE_PILL_AMBER } from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillLinkItem } from "@/components/navigation/ModulePillSubnav";

export const NUTRITION_SUBNAV_PATHS = {
  mealPlan: "/nutrition/meal-plan",
  tools: "/nutrition/tools",
} as const;

/** Il Piano è la landing del modulo e assorbe il vecchio Diario: /nutrition,
    fueling e le route storiche today/diary reindirizzano tutte qui. */
const PLAN_PATHS = ["/nutrition", "/nutrition/meal-plan", "/nutrition/fueling", "/nutrition/today", "/nutrition/diary"];
/** Le pagine analitiche restano raggiunte da «Strumenti». */
const TOOLS_PATHS = ["/nutrition/tools", "/nutrition/predictor", "/nutrition/integration"];

function normalize(pathname: string | null): string {
  if (!pathname) return "";
  return pathname.replace(/\/$/, "") || "/";
}

/**
 * Sotto-moduli nutrition (2026-07, Diario eliminato): il PIANO è l'unica
 * pagina della giornata — target + pasti + registro consumi + conferme +
 * idratazione. «Strumenti» raccoglie previsione, integratori e il rimando
 * a bioenergetica.
 */
export function NutritionSubnav() {
  const pathname = usePathname();
  const t = useTranslations("NutritionSubnav");

  const items: ModulePillLinkItem[] = [
    {
      key: "meal-plan",
      href: NUTRITION_SUBNAV_PATHS.mealPlan,
      label: t("plan"),
      icon: CalendarRange,
      style: MODULE_PILL_AMBER,
    },
    {
      key: "tools",
      href: NUTRITION_SUBNAV_PATHS.tools,
      label: t("tools"),
      icon: Wrench,
      style: MODULE_PILL_AMBER,
    },
  ];

  return (
    <ModulePillSubnav
      variant="link"
      items={items}
      isActive={(item) => {
        const p = normalize(pathname);
        if (item.key === "meal-plan") return PLAN_PATHS.includes(p);
        return TOOLS_PATHS.includes(p);
      }}
      ariaLabel={t("ariaLabel")}
    />
  );
}
