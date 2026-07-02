"use client";

import { CalendarDays, Utensils } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardAthleteHubCard } from "@/components/dashboard/DashboardAthleteHubCard";
import { MobileModulePageShell } from "@/components/shell/MobileModulePageShell";
import { Pro2Link } from "@/components/ui/empathy";
import { localCalendarDayIso } from "@/lib/datetime/local-calendar-day";

export default function MobileTodayPageView() {
  const t = useTranslations("MobileTodayPageView");
  const today = localCalendarDayIso();

  return (
    <MobileModulePageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <DashboardAthleteHubCard />
      <div className="grid gap-3">
        <Pro2Link
          href={`/m/training/session/${today}`}
          variant="secondary"
          className="flex items-center justify-center gap-2 border-cyan-500/35 bg-cyan-500/10 py-3"
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          {t("trainingLink")}
        </Pro2Link>
        <Pro2Link
          href="/m/nutrition"
          variant="secondary"
          className="flex items-center justify-center gap-2 border-orange-500/35 bg-orange-500/10 py-3"
        >
          <Utensils className="h-4 w-4 shrink-0" aria-hidden />
          {t("nutritionLink")}
        </Pro2Link>
      </div>
    </MobileModulePageShell>
  );
}
