"use client";

import { useTranslations } from "next-intl";

import { Pro2Link } from "@/components/ui/empathy";
import type { BuilderDayAdaptationResponse } from "@/modules/training/services/training-builder-day-adaptation-api";

/**
 * Pannello "Adattamento giorno" del builder seduta (decomposizione del God-component
 * TrainingBuilderRichPageView). Render-only: stato nel padre, passato via props.
 */
export type BuilderDayAdaptationPanelProps = {
  athleteId: string | null;
  plannedDate: string;
  dayAdaptationBusy: boolean;
  dayAdaptationErr: string | null;
  dayAdaptation: BuilderDayAdaptationResponse | null;
  replacePlannedIdFromQuery: string | null;
};

export function BuilderDayAdaptationPanel({
  athleteId,
  plannedDate,
  dayAdaptationBusy,
  dayAdaptationErr,
  dayAdaptation,
  replacePlannedIdFromQuery,
}: BuilderDayAdaptationPanelProps) {
  const t = useTranslations("BuilderDayAdaptationPanel");
  return (
    <>
        {athleteId ? (
          <section
            aria-label={t("sectionAriaLabel")}
            className="mb-4 rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85 p-4 sm:p-5 shadow-inner"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
                  {t("dayAdaptationLabel", { plannedDate })}
                </p>
                {dayAdaptationBusy ? (
                  <p className="mt-2 text-sm text-gray-400">{t("readingScore")}</p>
                ) : dayAdaptationErr ? (
                  <p className="mt-2 text-sm text-amber-200/90" role="alert">
                    {dayAdaptationErr}
                  </p>
                ) : dayAdaptation?.ok ? (
                  <>
                    <p className="mt-2 text-lg font-bold text-white">
                      {dayAdaptation.loadAdaptation.headline} ·{" "}
                      <span
                        className={
                          dayAdaptation.loadAdaptation.direction === "reduce"
                            ? "text-amber-300"
                            : dayAdaptation.loadAdaptation.direction === "increase"
                              ? "text-emerald-300"
                              : "text-gray-200"
                        }
                      >
                        {dayAdaptation.loadAdaptation.adjustmentPct > 0
                          ? `+${dayAdaptation.loadAdaptation.adjustmentPct}%`
                          : `${dayAdaptation.loadAdaptation.adjustmentPct}%`}{" "}
                        {t("loadWord")}
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">
                      {t("scoreSummary", {
                        scorePct: dayAdaptation.loadAdaptation.scorePct,
                        trafficLight: dayAdaptation.loadAdaptation.trafficLight,
                        loadScalePct: dayAdaptation.loadAdaptation.loadScalePct,
                      })}
                      {dayAdaptation.loadAdaptation.unwantedSupercompensation
                        ? t("unabsorbedSupercompensation")
                        : null}
                    </p>
                    {dayAdaptation.targetPlanned ? (
                      <p className="mt-2 font-mono text-xs tabular-nums text-orange-100/85">
                        {dayAdaptation.targetPlanned.baselineDurationMinutes}′ / TSS {dayAdaptation.targetPlanned.baselineTssTarget} →{" "}
                        {dayAdaptation.targetPlanned.adaptedDurationMinutes}′ / TSS {dayAdaptation.targetPlanned.adaptedTssTarget}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">{t("noSessionPlanned")}</p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">{t("openWithCalendarDate")}</p>
                )}
              </div>
              {/* Pannello SOLO informativo: la generazione applica già l'adattamento del giorno,
                  quindi un bottone «Genera» qui era un doppione di quello nello step «Genera». */}
              {replacePlannedIdFromQuery ? (
                <div className="flex flex-wrap gap-2">
                  <Pro2Link
                    href={`/training/calendar?date=${encodeURIComponent(plannedDate)}`}
                    variant="ghost"
                    className="border border-white/15 text-xs"
                  >
                    {t("calendar")}
                  </Pro2Link>
                </div>
              ) : null}
            </div>
            {dayAdaptation?.ok ? (
              <p className="mt-3 text-xs leading-relaxed text-gray-500">{dayAdaptation.loadAdaptation.guidance}</p>
            ) : null}
          </section>
        ) : null}
    </>
  );
}
