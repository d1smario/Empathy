"use client";

import { useTranslations } from "next-intl";
import { Activity, Flame, Heart, Timer } from "lucide-react";
import { ResearchTraceScientificPanel } from "@/components/training/ResearchTraceScientificPanel";
import { Pro2Accordion, Pro2Button } from "@/components/ui/empathy";
import { ACCENT_KPI } from "@/lib/training/training-builder-rich-kit";

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: keyof typeof ACCENT_KPI;
  icon: typeof Activity;
}) {
  const a = ACCENT_KPI[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur-sm ${a.border} ${a.bg} ${a.ring} ${a.glow}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-95 ${a.bar}`}
        aria-hidden
      />
      <div className="relative pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconWrap}`}
            aria-hidden
          >
            <Icon className={`h-5 w-5 ${a.icon}`} strokeWidth={2.35} />
          </div>
        </div>
        <p className={`mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight ${a.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Accordion finale «Dettagli e motore» del builder seduta: contesto generativo
 * (tracce ricerca + asset esterni + sintesi nutrizione) e KPI della finestra calendario.
 * (decomposizione del God-component TrainingBuilderRichPageView).
 * Display-only: stato nel padre, passato via props. `KpiCard` è locale (uso interno).
 */
export type BuilderDetailsEngineAccordionProps = {
  athleteId: string | null;
  plannedDate: string;
  nutritionBusy: boolean;
  nutritionErr: string | null;
  nutritionLine: string | null;
  refreshNutritionContext: () => Promise<void>;
  showData: boolean;
  stats: {
    pTss: number;
    eTss: number;
    pMin: number;
    eMin: number;
    sessionsPlanned: number;
    sessionsExecuted: number;
  };
  range: { from: string; to: string } | null;
};

export function BuilderDetailsEngineAccordion({
  athleteId,
  plannedDate,
  nutritionBusy,
  nutritionErr,
  nutritionLine,
  refreshNutritionContext,
  showData,
  stats,
  range,
}: BuilderDetailsEngineAccordionProps) {
  const t = useTranslations("BuilderDetailsEngineAccordion");
  return (
        <Pro2Accordion
          id="mod-dettagli-motore"
          title={t("accordionTitle")}
          subtitle={t("accordionSubtitle")}
          accent="orange"
        >
          <div className="space-y-6">
            <section
              aria-label={t("generativeContextAria")}
              className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5 shadow-inner"
            >
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
                {t("builderGenerativeContext")}
              </p>
              <p className="mt-1 max-w-3xl text-xs text-gray-500">
                {t("supportAuditNote")}
              </p>
              {!athleteId ? (
                <p className="mt-3 text-sm text-gray-500">{t("selectAthletePrompt")}</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <ResearchTraceScientificPanel athleteId={athleteId} limit={16} traceSurface="latest_primary" />
                  <div className="rounded-xl border border-orange-500/25 bg-orange-950/10 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">{t("nutritionEngineSessionDay")}</p>
                        <p className="mt-0.5 font-mono text-[0.7rem] text-gray-500">{plannedDate}</p>
                      </div>
                      <Pro2Button
                        type="button"
                        variant="secondary"
                        disabled={nutritionBusy}
                        className="border-orange-500/30 bg-orange-500/10 text-xs text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
                        onClick={() => void refreshNutritionContext()}
                      >
                        {nutritionBusy ? t("reading") : t("refreshSummary")}
                      </Pro2Button>
                    </div>
                    {nutritionErr ? <p className="mt-2 text-xs text-amber-200/90">{nutritionErr}</p> : null}
                    {nutritionLine ? (
                      <p className="mt-2 text-sm text-gray-200">{nutritionLine}</p>
                    ) : !nutritionErr && !nutritionBusy ? (
                      <p className="mt-2 text-xs text-gray-500">{t("readOnlyNutritionApi")}</p>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            <section aria-label={t("windowKpisAria")} className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
              <KpiCard
                label={t("plannedTss")}
                value={showData ? Math.round(stats.pTss).toString() : "—"}
                hint={range ? `${range.from} → ${range.to}` : undefined}
                accent="orange"
                icon={Flame}
              />
              <KpiCard
                label={t("executedTss")}
                value={showData ? Math.round(stats.eTss).toString() : "—"}
                hint={t("inTheSameWindow")}
                accent="orange"
                icon={Activity}
              />
              <KpiCard
                label={t("sessionsPlanExec")}
                value={showData ? `${stats.sessionsPlanned} / ${stats.sessionsExecuted}` : "—"}
                accent="orange"
                icon={Timer}
              />
              <KpiCard
                label={t("totalMinutes")}
                value={showData ? `${Math.round(stats.pMin + stats.eMin)}` : "—"}
                hint={t("plannedExecutedRawSum")}
                accent="orange"
                icon={Heart}
              />
            </section>
          </div>
        </Pro2Accordion>
  );
}
