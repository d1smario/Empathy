"use client";

/**
 * Trend per-area della dashboard desktop (F3) — parità con MobileTrendsSection.
 * Le serie vengono dagli snapshot giornalieri `dashboard_daily_scores` (~30 giorni,
 * si accumulano a ogni visita) con fallback sulle serie 7g in-memory del composer.
 */

import { useTranslations } from "next-intl";
import { DashboardSparkline } from "@/components/dashboard/DashboardSparkline";
import { AREA_THEME, AREA_ORDER } from "@/lib/dashboard/dashboard-ui-config";
import type { DashboardArea, DashboardAreaKey } from "@/lib/dashboard/dashboard-scores";

export type DashboardTrendsSectionProps = {
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

export function DashboardTrendsSection({ areas }: DashboardTrendsSectionProps) {
  const t = useTranslations("DashboardTrendsSection");
  const byKey = new Map(areas.map((a) => [a.key, a]));
  const ordered = AREA_ORDER.map((k) => byKey.get(k)).filter((a): a is DashboardArea => Boolean(a));
  // Con meno di 2 punti ovunque la sezione non ha nulla da raccontare: hint al posto delle card.
  const hasAnySeries = ordered.some((a) => a.trend.length >= 2);

  return (
    <section aria-label={t("title")}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("title")}</p>
        <span className="text-[0.65rem] text-gray-600">{t("subtitle")}</span>
      </div>
      {!hasAnySeries ? (
        <p className="rounded-2xl border border-dashed border-white/15 bg-black/25 px-4 py-5 text-sm text-gray-500">
          {t("emptyHint")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {ordered.map((area) => {
            const theme = AREA_THEME[area.key as DashboardAreaKey];
            const change = pctChange(area.trend);
            return (
              <div key={area.key} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                <div className={`text-[0.6rem] uppercase tracking-wider ${theme.text}`}>{area.label}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xl font-bold tabular-nums text-white">{fmtScore(area.score)}</span>
                  {change ? (
                    <span
                      className="text-xs font-medium"
                      style={{ color: change.startsWith("↑") ? "#34d399" : "#fb7185" }}
                    >
                      {change}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  <DashboardSparkline values={area.trend} color={theme.ring} height={32} showDots={false} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
