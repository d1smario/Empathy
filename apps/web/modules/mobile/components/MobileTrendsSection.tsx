"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { DashboardSparkline } from "@/components/dashboard/DashboardSparkline";
import { AREA_THEME, AREA_ORDER } from "@/lib/dashboard/dashboard-ui-config";
import type { DashboardArea, DashboardAreaKey } from "@/lib/dashboard/dashboard-scores";

export type MobileTrendsSectionProps = {
  areas: DashboardArea[];
};

function fmtScore(score: number | null): string {
  return score == null ? "—" : String(Math.round(score));
}

function pctChange(values: number[]): string | null {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (!first) return null;
  const change = ((last - first) / first) * 100;
  const sign = change >= 0 ? "↑" : "↓";
  return `${sign} ${Math.abs(change).toFixed(0)}%`;
}

export function MobileTrendsSection({ areas }: MobileTrendsSectionProps) {
  const t = useTranslations("MobileTrendsSection");
  const byKey = new Map(areas.map((a) => [a.key, a]));
  const ordered = AREA_ORDER.map((k) => byKey.get(k)).filter((a): a is DashboardArea => Boolean(a));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white">{t("sevenDayTrends")}</h2>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.6rem] font-medium text-gray-400"
        >
          {t("sevenDays")} <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ordered.map((area) => {
          const theme = AREA_THEME[area.key as DashboardAreaKey];
          const change = pctChange(area.trend);
          return (
            <div
              key={area.key}
              className="rounded-xl border border-white/10 bg-black/30 px-2 py-2"
            >
              <div className={`text-[0.5rem] uppercase tracking-wider ${theme.text}`}>{area.label}</div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-base font-bold tabular-nums text-white">{fmtScore(area.score)}</span>
                {change ? (
                  <span
                    className="text-[0.55rem] font-medium"
                    style={{ color: change.startsWith("↑") ? "#34d399" : "#fb7185" }}
                  >
                    {change}
                  </span>
                ) : null}
              </div>
              <div className="mt-1">
                <DashboardSparkline values={area.trend} color={theme.ring} height={24} showDots={false} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
