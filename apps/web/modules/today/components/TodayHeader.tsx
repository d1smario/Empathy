"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { TodayReadiness } from "@/app/api/today/contracts";

function formatDate(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function greetingKey(hour: number): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

export function TodayHeader({
  firstName,
  date,
  readiness,
}: {
  firstName: string | null;
  date: string;
  readiness: TodayReadiness;
}) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const hour = new Date().getHours();
  const greeting = firstName ? t("greetingWithName", { name: firstName }) : t(greetingKey(hour));

  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{greeting}</h1>
        <p className="mt-1 capitalize text-gray-400">{formatDate(date, locale)}</p>
        <p className="mt-3 text-sm italic text-gray-300">&ldquo;{t("quote")}&rdquo;</p>
      </div>
      <Link
        href="/analysis"
        className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center transition hover:border-fuchsia-500/40 hover:bg-white/10"
      >
        <Activity className="h-6 w-6 text-fuchsia-300" />
        {readiness.score != null ? (
          <>
            <span className="text-lg font-black leading-none text-white">{Math.round(readiness.score)}</span>
            <span className="text-[0.6rem] uppercase tracking-wider text-gray-400">{t("readiness")}</span>
          </>
        ) : (
          <span className="text-[0.65rem] text-gray-400">{t("analysisLink")}</span>
        )}
      </Link>
    </header>
  );
}
