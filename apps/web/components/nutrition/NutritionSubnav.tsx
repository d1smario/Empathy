"use client";

import { BookOpen, CalendarRange, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MODULE_PILL_AMBER } from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillLinkItem } from "@/components/navigation/ModulePillSubnav";

export const NUTRITION_SUBNAV_PATHS = {
  mealPlan: "/nutrition/meal-plan",
  diary: "/nutrition/today",
  tools: "/nutrition/tools",
} as const;

/** Il Piano è la landing del modulo (/nutrition vi reindirizza) + il fueling storico. */
const PLAN_PATHS = ["/nutrition", "/nutrition/meal-plan", "/nutrition/fueling"];
/** Il Diario vive su /nutrition/today (il vecchio /nutrition/diary vi reindirizza). */
const DIARY_PATHS = ["/nutrition/today", "/nutrition/diary"];
/** Le pagine analitiche restano raggiunte da «Strumenti». */
const TOOLS_PATHS = ["/nutrition/tools", "/nutrition/predictor", "/nutrition/integration"];

function normalize(pathname: string | null): string {
  if (!pathname) return "";
  return pathname.replace(/\/$/, "") || "/";
}

/**
 * Sotto-moduli nutrition — split prescrittivo/consuntivo (2026-07):
 * Piano (landing: target + pasti + protocollo rifornimento = «cosa mangiare») ·
 * Diario (segna cosa hai mangiato + conferma rifornimento) · Strumenti
 * (previsione, integratori, rimando bioenergetica). La pillola cross-modulo
 * «Bioenergetica» non vive più qui: è una card dentro Strumenti.
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
      key: "diary",
      href: NUTRITION_SUBNAV_PATHS.diary,
      label: t("diary"),
      icon: BookOpen,
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
        if (item.key === "diary") return DIARY_PATHS.includes(p);
        return TOOLS_PATHS.includes(p);
      }}
      ariaLabel={t("ariaLabel")}
    />
  );
}
