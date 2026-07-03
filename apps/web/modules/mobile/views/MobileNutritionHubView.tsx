"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, Utensils, Zap } from "lucide-react";
import { MobileModulePageShell } from "@/components/shell/MobileModulePageShell";
import { Pro2Link } from "@/components/ui/empathy";

export default function MobileNutritionHubView() {
  const t = useTranslations("MobileNutritionHubView");
  return (
    <MobileModulePageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <div className="grid gap-3">
        <Link
          href="/m/nutrition/meal-plan"
          className="flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-4 transition hover:border-orange-400/50"
        >
          <Utensils className="h-5 w-5 shrink-0 text-orange-300" aria-hidden />
          <div>
            <p className="font-semibold text-white">{t("mealPlanTitle")}</p>
            <p className="text-xs text-gray-400">{t("mealPlanSubtitle")}</p>
          </div>
        </Link>
        <Link
          href="/m/nutrition/fueling"
          className="flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 transition hover:border-cyan-400/50"
        >
          <Zap className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
          <div>
            <p className="font-semibold text-white">{t("fuelingTitle")}</p>
            <p className="text-xs text-gray-400">{t("fuelingSubtitle")}</p>
          </div>
        </Link>
        <Link
          href="/m/nutrition/diary"
          className="flex items-center gap-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-4 transition hover:border-fuchsia-400/50"
        >
          <BookOpen className="h-5 w-5 shrink-0 text-fuchsia-300" aria-hidden />
          <div>
            <p className="font-semibold text-white">{t("diaryTitle")}</p>
            <p className="text-xs text-gray-400">{t("diarySubtitle")}</p>
          </div>
        </Link>
      </div>
      <Pro2Link href="/nutrition/meal-plan" variant="ghost" className="text-xs text-gray-500">
        {t("openDesktopMealPlan")}
      </Pro2Link>
    </MobileModulePageShell>
  );
}
