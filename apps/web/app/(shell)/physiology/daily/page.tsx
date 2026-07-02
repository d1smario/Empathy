"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { localCalendarDayIso } from "@/lib/datetime/local-calendar-day";

/**
 * `/physiology/daily` → redirect al giorno locale corrente (`/physiology/daily/YYYY-MM-DD`).
 */
export default function PhysiologyDailyTodayEntryPage() {
  const router = useRouter();
  const t = useTranslations("PhysiologyDailyPage");

  useEffect(() => {
    router.replace(`/physiology/daily/${localCalendarDayIso()}`);
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-sm text-gray-400">{t("redirecting")}</p>
    </div>
  );
}
