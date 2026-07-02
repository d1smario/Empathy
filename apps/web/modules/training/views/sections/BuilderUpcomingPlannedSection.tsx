"use client";

import {
  formatExecutedWorkoutSummary,
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { Activity, CalendarDays, CalendarOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatPlannedWorkoutCardTitle } from "@/lib/training/planned/format-planned-workout-title";

/**
 * Sezione "Prossime pianificate" + "Ultime eseguite" del builder seduta
 * (decomposizione del God-component TrainingBuilderRichPageView).
 * Display-only: stato nel padre, passato via props.
 */
export type BuilderUpcomingPlannedSectionProps = {
  ctxLoading: boolean;
  loading: boolean;
  err: string | null;
  showData: boolean;
  upcoming: PlannedWorkout[];
  executed: ExecutedWorkout[];
};

export function BuilderUpcomingPlannedSection({
  ctxLoading,
  loading,
  err,
  showData,
  upcoming,
  executed,
}: BuilderUpcomingPlannedSectionProps) {
  const t = useTranslations("BuilderUpcomingPlannedSection");
  return (
        <section
          aria-label={t("regionLabel")}
          className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner sm:p-5 lg:p-6"
        >
          <div className="mb-4 flex flex-wrap items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-orange-400/45 bg-orange-500/35 text-orange-50 shadow-[0_0_16px_rgba(251,146,60,0.35)]">
              <CalendarDays className="h-5 w-5" strokeWidth={2.35} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">{t("title")}</h2>
              <p className="mt-1 text-sm text-gray-400">{t("subtitle")}</p>
            </div>
          </div>
          {ctxLoading || loading ? (
            <div className="mt-4 h-10 w-full max-w-xs animate-pulse rounded-full bg-orange-500/15" />
          ) : null}
          {err ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
              {err}
            </p>
          ) : null}
          {showData && upcoming.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
              <CalendarOff className="h-8 w-8 text-orange-400" aria-hidden />
              <p className="mt-5 text-base font-semibold text-white">{t("emptyTitle")}</p>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                {t("emptyBody")}
              </p>
            </div>
          ) : null}
          {showData && upcoming.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {upcoming.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 transition-colors hover:border-orange-500/40 hover:bg-white/[0.05]"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 font-mono text-xs font-semibold text-orange-300">
                    <CalendarDays className="h-3.5 w-3.5 text-orange-300" aria-hidden />
                    {w.date}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-white">{formatPlannedWorkoutCardTitle(w)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {showData && executed.length > 0 ? (
            <div className="mt-8 border-t border-orange-500/20 pt-6">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-orange-400/40 bg-orange-500/25 text-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.25)]">
                  <Activity className="h-4 w-4" strokeWidth={2.35} aria-hidden />
                </span>
                {t("lastExecuted")}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {[...executed]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 5)
                  .map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-950/25 to-black/50 px-3 py-2.5 text-sm"
                    >
                      <span className="inline-flex rounded-full border border-orange-400/40 bg-orange-500/15 px-2.5 py-0.5 font-mono text-xs text-orange-100">
                        {w.date}
                      </span>
                      <span className="text-gray-200">{formatExecutedWorkoutSummary(w)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
  );
}
