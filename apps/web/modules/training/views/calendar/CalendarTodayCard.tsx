"use client";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import { formatExecutedWorkoutSummary } from "@empathy/domain-training";
import { Activity, Heart, LayoutGrid, LineChart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { useScopedSessionHref } from "@/lib/training/use-scoped-session-href";

export interface CalendarTodayCardProps {
  selectedDate: string;
  dayPlanned: PlannedWorkout[];
  dayExecuted: ExecutedWorkout[];
  builderReplacePlanned: PlannedWorkout | null;
}

/**
 * Lavoro principale del Calendario: il giorno selezionato con UNA sola CTA primaria
 * verso il Builder. Fonde il vecchio blocco azioni Builder e l'aside «Giorno selezionato».
 * L'id `calendar-day-builder-actions` è storico: target di scroll dalla griglia.
 */
export function CalendarTodayCard({
  selectedDate,
  dayPlanned,
  dayExecuted,
  builderReplacePlanned,
}: CalendarTodayCardProps) {
  const t = useTranslations("CalendarTodayCard");
  // Scope-aware: in scope coach/admin il dettaglio giorno resta nello scope (rotta annidata).
  const sessionHrefFor = useScopedSessionHref();
  const selectedSessionHref = sessionHrefFor(selectedDate);
  const dayLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div id="calendar-day-builder-actions" className="mb-8 scroll-mt-24 w-full min-w-0">
      <Pro2SectionCard
        accent="orange"
        title={dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}
        subtitle={
          dayPlanned.length > 0
            ? t("subtitleAdapt")
            : t("subtitleCreate")
        }
        icon={LayoutGrid}
      >
        <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Pro2Link
            href={`/training/builder?date=${encodeURIComponent(selectedDate)}`}
            variant="primary"
            className="w-full justify-center sm:w-auto"
          >
            {t("ctaCreateOrAdapt")}
          </Pro2Link>
          {builderReplacePlanned ? (
            <Pro2Link
              href={`/training/builder?date=${encodeURIComponent(selectedDate)}&replace_planned_id=${encodeURIComponent(builderReplacePlanned.id)}`}
              variant="ghost"
              className="w-full justify-center border border-orange-500/30 bg-orange-500/10 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20 sm:w-auto"
            >
              {t("replaceSession")}
            </Pro2Link>
          ) : null}
          <Pro2Link
            href={selectedSessionHref}
            variant="ghost"
            className="w-full justify-center border border-orange-500/30 bg-orange-500/10 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20 sm:w-auto"
          >
            <LineChart className="mr-1 inline h-4 w-4" aria-hidden />
            {t("day")}
          </Pro2Link>
          <Pro2Link
            href={`/physiology/daily/${encodeURIComponent(selectedDate)}`}
            variant="ghost"
            className="w-full justify-center border border-orange-500/30 bg-orange-500/10 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20 sm:w-auto"
          >
            <Heart className="mr-1 inline h-4 w-4" aria-hidden />
            {t("physiology")}
          </Pro2Link>
        </div>

        <div className="mt-4 space-y-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("planned")}</p>
          {dayPlanned.length === 0 ? (
            <p className="text-sm text-gray-500">
              {t("noPlannedSession")}
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-300">
                {t("plannedCount", { count: dayPlanned.length })}
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-orange-300/90 underline-offset-2 hover:underline"
                onClick={() =>
                  document.getElementById("calendar-day-planned-detail")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                {t("goToPlanned")}
              </button>
            </>
          )}
        </div>

        <div className="mt-6 space-y-3 border-t border-white/10 pt-6">
          <p className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            {t("completed")}
          </p>
          {dayExecuted.length === 0 ? (
            <p className="text-sm text-gray-500">{t("nothingCompleted")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dayExecuted.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-orange-500/40 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{formatExecutedWorkoutSummary(w)}</span>
                    <Pro2Link
                      href={selectedSessionHref}
                      variant="ghost"
                      className="shrink-0 border border-orange-500/30 px-2 py-1 text-xs text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
                    >
                      {t("open")}
                    </Pro2Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Pro2SectionCard>
    </div>
  );
}
