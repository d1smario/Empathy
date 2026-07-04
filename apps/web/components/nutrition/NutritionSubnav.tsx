"use client";

import { CalendarRange, Sun, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MODULE_PILL_AMBER } from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillLinkItem } from "@/components/navigation/ModulePillSubnav";

export const NUTRITION_SUBNAV_PATHS = {
  today: "/nutrition/today",
  mealPlan: "/nutrition/meal-plan",
  tools: "/nutrition/tools",
} as const;

/** Path storici assorbiti da «Oggi» (redirect server, ma teniamo attivo il pill giusto). */
const TODAY_LEGACY_PATHS = ["/nutrition", "/nutrition/today", "/nutrition/fueling", "/nutrition/diary"];
/** Le pagine analitiche restano raggiunte da «Strumenti». */
const TOOLS_PATHS = ["/nutrition/tools", "/nutrition/predictor", "/nutrition/integration"];

function normalize(pathname: string | null): string {
  if (!pathname) return "";
  return pathname.replace(/\/$/, "") || "/";
}

/**
 * Sotto-moduli nutrition riorganizzati «per momento d'uso» (2026-07):
 * Oggi (rifornimento + diario del giorno) · Piano (meal plan) · Strumenti
 * (previsione, integratori, rimando bioenergetica). La pillola cross-modulo
 * «Bioenergetica» non vive più qui: è una card dentro Strumenti.
 */
export function NutritionSubnav() {
  const pathname = usePathname();
  const t = useTranslations("NutritionSubnav");

  const items: ModulePillLinkItem[] = [
    {
      key: "today",
      href: NUTRITION_SUBNAV_PATHS.today,
      label: t("today"),
      icon: Sun,
      style: MODULE_PILL_AMBER,
    },
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
        if (item.key === "today") return TODAY_LEGACY_PATHS.includes(p);
        if (item.key === "tools") return TOOLS_PATHS.includes(p);
        return p === item.href || p.startsWith(`${item.href}/`);
      }}
      ariaLabel={t("ariaLabel")}
    />
  );
}
