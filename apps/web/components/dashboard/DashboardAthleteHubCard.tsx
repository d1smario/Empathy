"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { EmpathyApplicationPlaybook } from "@empathy/contracts";
import { useAthleteOperationalHub } from "@/lib/dashboard/use-athlete-operational-hub";
import { Pro2Link } from "@/components/ui/empathy";
import type { OperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import { fetchNutritionModuleContext } from "@/modules/nutrition/services/nutrition-module-api";

function parseDynamicsBracketLine(line: string): { tag: string; body: string } | null {
  const m = line.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (!m) return null;
  return { tag: m[1].trim(), body: m[2].trim() };
}

function trafficLightTone(tl: string): "green" | "amber" | "rose" | "slate" {
  if (tl === "green") return "green";
  if (tl === "yellow") return "amber";
  if (tl === "red") return "rose";
  return "slate";
}

function trafficLightTextClass(tl: string): string {
  const tone = trafficLightTone(tl);
  if (tone === "green") return "text-emerald-300";
  if (tone === "amber") return "text-amber-200";
  if (tone === "rose") return "text-rose-300";
  return "text-gray-300";
}

function HubOpCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone: "orange" | "cyan" | "violet" | "green" | "amber" | "rose" | "slate";
}) {
  const border =
    tone === "orange"
      ? "border-orange-400/25"
      : tone === "cyan"
        ? "border-cyan-400/25"
        : tone === "violet"
          ? "border-violet-400/25"
          : tone === "green"
            ? "border-emerald-500/30"
            : tone === "amber"
              ? "border-amber-400/25"
              : tone === "rose"
                ? "border-rose-400/25"
                : "border-white/10";
  const glow =
    tone === "orange"
      ? "from-orange-500/10"
      : tone === "cyan"
        ? "from-cyan-500/10"
        : tone === "violet"
          ? "from-violet-500/10"
          : tone === "green"
            ? "from-emerald-500/10"
            : tone === "amber"
              ? "from-amber-500/10"
              : tone === "rose"
                ? "from-rose-500/10"
                : "from-white/5";
  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${border} bg-gradient-to-br ${glow} to-black/40 px-3 py-2.5`}
    >
      <div className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-gray-500">{label}</div>
      <div className="mt-1 break-words font-mono text-base font-semibold leading-tight text-gray-100">{value}</div>
      {sub ? <div className="mt-1 text-[0.65rem] leading-snug text-gray-500">{sub}</div> : null}
    </div>
  );
}

function HubOperationalDocs({
  signals,
  dynamicsLines,
}: {
  signals: OperationalSignalsBundle;
  dynamicsLines: string[];
}) {
  const t = useTranslations("DashboardAthleteHubCard");
  const ag = signals.adaptationGuidance;
  const loop = signals.adaptationLoop;
  const nut = signals.nutritionPerformanceIntegration;
  const op = signals.operationalContext;
  const expected = ag.expectedAdaptation;
  const observed = ag.observedAdaptation;
  const scoreFormula =
    expected > 0
      ? t("scoreFormulaWithValues", { observed, expected, scorePct: ag.scorePct })
      : t("scoreFormulaExpectedZero");

  return (
    <details className="mt-3 mb-4 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-gray-400">
      <summary className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-wider text-gray-300">
        {t("docsSummary")}
      </summary>
      <div className="mt-3 space-y-4 border-t border-white/10 pt-3 leading-relaxed">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-orange-300/90">{t("adaptationTwinTitle")}</p>
          <p className="mt-1">
            {t.rich("adaptationTwinSource", {
              v: (chunks) => <span className="text-gray-300">{chunks}</span>,
              s: (chunks) => <span className="text-gray-300">{chunks}</span>,
            })}
          </p>
          <p className="mt-1 font-mono text-[0.65rem] text-gray-500">{scoreFormula}</p>
          <p className="mt-1">
            {t.rich("adaptationTrafficLightRule", {
              s: (chunks) => <span className="text-gray-300">{chunks}</span>,
            })}
          </p>
          {ag.guidance ? <p className="mt-1 text-gray-500">{ag.guidance}</p> : null}
        </div>
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-cyan-300/90">{t("calendarLoopTitle")}</p>
          <p className="mt-1">
            {t.rich("calendarLoopDivergence", {
              s: (chunks) => <span className="text-gray-300">{chunks}</span>,
              m: (chunks) => <span className="font-mono text-gray-500">{chunks}</span>,
            })}
          </p>
          <p className="mt-1">
            {t.rich("calendarLoopStatusAction", {
              status: loop.status,
              action: loop.nextAction,
              val: (chunks) => <span className="font-mono text-cyan-200/80">{chunks}</span>,
              s: (chunks) => <span className="text-gray-300">{chunks}</span>,
            })}
          </p>
          {loop.guidance ? <p className="mt-1 text-gray-500">{loop.guidance}</p> : null}
        </div>
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-violet-300/90">{t("nutritionDialTitle")}</p>
          <p className="mt-1">
            {t.rich("nutritionDialBody", {
              s: (chunks) => <span className="text-gray-300">{chunks}</span>,
              m: (chunks) => <span className="font-mono text-gray-500">{chunks}</span>,
              br: () => <br />,
              note: (chunks) => <span className="text-amber-200/80">{chunks}</span>,
            })}
          </p>
          {nut.rationale.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-gray-500">
              {nut.rationale.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-cyan-300/90">{t("crossModuleRowsTitle")}</p>
          <p className="mt-1">
            {t.rich("crossModuleRowsBody", {
              s: (chunks) => <span className="text-gray-300">{chunks}</span>,
              opctx: op ? ` (~${op.loadScalePct}% · ${op.mode})` : "",
            })}
          </p>
          {dynamicsLines.length > 0 ? (
            <ul className="mt-2 list-inside list-disc font-mono text-[0.65rem] text-gray-500">
              {dynamicsLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function HubRow({
  href,
  title,
  children,
}: {
  href: `/${string}`;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-white/10 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Pro2Link href={href} variant="ghost" className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-pink-300">
          {title}
        </Pro2Link>
      </div>
      <div className="mt-1 text-sm leading-relaxed text-gray-300">{children}</div>
    </div>
  );
}

export function DashboardAthleteHubCard() {
  const t = useTranslations("DashboardAthleteHubCard");
  const { athleteId, ctxLoading, loading, error: err, hub } = useAthleteOperationalHub();
  const [playbookPreview, setPlaybookPreview] = useState<EmpathyApplicationPlaybook | null>(null);
  const showLoading = ctxLoading || loading;

  useEffect(() => {
    if (!athleteId || showLoading) return;
    const today = new Date().toISOString().slice(0, 10);
    let cancelled = false;
    void fetchNutritionModuleContext({
      athleteId,
      from: today,
      to: today,
      pathwayDate: today,
      mode: "pathway",
    })
      .then((snap) => {
        if (!cancelled) setPlaybookPreview(snap.applicationPlaybook ?? null);
      })
      .catch(() => {
        if (!cancelled) setPlaybookPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId, showLoading]);

  return (
    <section
      className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-4 text-left backdrop-blur-md sm:p-6"
      aria-label={t("sectionAriaLabel")}
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-orange-300">{t("kicker")}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-white">{t("title")}</h2>
        <Pro2Link
          href="/physiology/bioenergetics"
          variant="secondary"
          className="shrink-0 border border-emerald-500/35 bg-emerald-500/10 text-xs hover:bg-emerald-500/15"
        >
          {t("transparency")}
        </Pro2Link>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {t("summaryLine")}
      </p>

      {showLoading ? (
        <div className="mt-6 h-2 w-48 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!showLoading && err ? (
        <p className="mt-6 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!showLoading && !err && hub ? (
        <div className="mt-6">
          {hub.operationalSignals ? (
            <div className="mb-4 rounded-xl border border-orange-400/25 bg-orange-950/20 px-4 py-3 text-sm text-gray-200">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-orange-300/90">
                {t("bioenergeticsHeader")}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                <HubOpCell
                  label={t("cellTwinExpected")}
                  value={hub.operationalSignals.adaptationGuidance.expectedAdaptation.toFixed(2)}
                  tone="orange"
                />
                <HubOpCell
                  label={t("cellTwinObserved")}
                  value={hub.operationalSignals.adaptationGuidance.observedAdaptation.toFixed(2)}
                  tone="orange"
                />
                <HubOpCell
                  label={t("cellTrafficLight")}
                  value={
                    <span className={trafficLightTextClass(hub.operationalSignals.adaptationGuidance.trafficLight)}>
                      {hub.operationalSignals.adaptationGuidance.trafficLight}
                    </span>
                  }
                  tone={trafficLightTone(hub.operationalSignals.adaptationGuidance.trafficLight)}
                />
                <HubOpCell label={t("cellScorePct")} value={`${hub.operationalSignals.adaptationGuidance.scorePct}%`} tone="slate" />
                <HubOpCell
                  label={t("cellLoopStatus")}
                  value={<span className="text-cyan-200">{hub.operationalSignals.adaptationLoop.status}</span>}
                  tone="cyan"
                />
                <HubOpCell
                  label={t("cellLoopNextAction")}
                  value={<span className="break-all text-cyan-200/90">{hub.operationalSignals.adaptationLoop.nextAction}</span>}
                  tone="cyan"
                />
                <HubOpCell
                  label={t("cellLoopDivergence")}
                  value={hub.operationalSignals.adaptationLoop.divergenceScore.toFixed(2)}
                  sub={t("cellLoopDivergenceSub")}
                  tone="cyan"
                />
                <HubOpCell
                  label={t("cellRecoveryBio")}
                  value={`×${hub.operationalSignals.nutritionPerformanceIntegration.trainingEnergyScale.toFixed(2)}`}
                  tone="violet"
                  sub={t("cellRecoveryBioSub")}
                />
                <HubOpCell
                  label={t("cellChoFueling")}
                  value={`×${hub.operationalSignals.nutritionPerformanceIntegration.fuelingChoScale.toFixed(2)}`}
                  tone="violet"
                />
                <HubOpCell
                  label={t("cellProteinBias")}
                  value={`+${hub.operationalSignals.nutritionPerformanceIntegration.proteinBiasPctPoints.toFixed(1)} pt`}
                  tone="violet"
                />
                <HubOpCell
                  label={t("cellMealTrainingShare")}
                  value={`${Math.round(hub.operationalSignals.nutritionPerformanceIntegration.mealTrainingFraction * 100)}%`}
                  tone="violet"
                />
                <HubOpCell
                  label={t("cellHydrationFloor")}
                  value={`×${hub.operationalSignals.nutritionPerformanceIntegration.hydrationFloorMultiplier.toFixed(2)}`}
                  tone="violet"
                />
                <HubOpCell
                  label={t("cellCoachTrace")}
                  value={hub.operationalSignals.coachValidatedApplicationTraceCount}
                  sub={t("cellCoachTraceSub")}
                  tone="green"
                />
              </div>
            </div>
          ) : null}
          {hub.expectedVsObtainedPreview &&
          (hub.expectedVsObtainedPreview.loopClosureSummary ||
            hub.expectedVsObtainedPreview.date ||
            hub.expectedVsObtainedPreview.recentCoachTracesInHint > 0) ? (
            <div className="mb-4 rounded-xl border border-slate-500/25 bg-slate-950/25 px-4 py-3 text-xs text-gray-300">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-slate-400">{t("planVsRealityHeader")}</p>
              {hub.expectedVsObtainedPreview.date ? (
                <p className="mt-2 font-mono text-[0.7rem] text-gray-400">
                  {hub.expectedVsObtainedPreview.date}
                  {hub.expectedVsObtainedPreview.status ? ` · ${hub.expectedVsObtainedPreview.status}` : ""}
                </p>
              ) : null}
              {hub.expectedVsObtainedPreview.loopClosureSummary ? (
                <p className="mt-2 leading-relaxed text-gray-200">{hub.expectedVsObtainedPreview.loopClosureSummary}</p>
              ) : null}
              {hub.expectedVsObtainedPreview.recentCoachTracesInHint > 0 ? (
                <p className="mt-2 text-[0.65rem] text-slate-500">
                  {t("deltaHintTraces", { count: hub.expectedVsObtainedPreview.recentCoachTracesInHint })}
                </p>
              ) : null}
            </div>
          ) : null}
          {playbookPreview && playbookPreview.directives.length > 0 ? (
            <div className="mb-4 rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/15 px-4 py-3 text-sm text-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-fuchsia-300/90">
                  {t("playbookHeader")}
                </p>
                <Pro2Link href="/nutrition/integration" variant="ghost" className="text-[0.65rem] text-pink-300">
                  {t("integrationLink")}
                </Pro2Link>
              </div>
              <p className="mt-2 text-xs text-gray-400">{playbookPreview.playbookHeadlineIt}</p>
              <ul className="mt-2 list-none space-y-1.5 pl-0 text-[0.78rem]">
                {playbookPreview.directives.slice(0, 3).map((d) => (
                  <li key={d.id}>
                    <span className="text-white">{d.headlineIt}</span>
                    <span className="text-gray-400"> — {d.actionIt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {hub.crossModuleDynamicsLines.length > 0 ? (
            <div className="mb-4 rounded-xl border border-cyan-500/25 bg-cyan-950/15 px-4 py-3 text-sm text-gray-200">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-cyan-300/90">
                {t("crossModuleHeader")}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hub.crossModuleDynamicsLines.slice(0, 8).map((line, i) => {
                  const parsed = parseDynamicsBracketLine(line);
                  if (!parsed) {
                    return (
                      <HubOpCell key={i} label={t("rowLabel", { n: i + 1 })} value={line} tone="slate" />
                    );
                  }
                  return <HubOpCell key={i} label={parsed.tag} value={parsed.body} tone="cyan" />;
                })}
              </div>
            </div>
          ) : null}
          {hub.operationalSignals ? (
            <HubOperationalDocs signals={hub.operationalSignals} dynamicsLines={hub.crossModuleDynamicsLines} />
          ) : null}
          <details className="mb-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
            <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider text-cyan-300/90">
              {t("readSpineSummary", { coverage: hub.readSpineCoverage.spineScore })}
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  [t("spineProfile"), hub.readSpineCoverage.hasProfile],
                  [t("spinePhysiology"), hub.readSpineCoverage.hasPhysiology],
                  ["Twin", hub.readSpineCoverage.hasTwin],
                  [t("spineNutrition"), hub.readSpineCoverage.hasNutritionConstraints || hub.readSpineCoverage.hasNutritionDiary],
                  ["Health panels", hub.readSpineCoverage.hasHealthPanels],
                  ["Reality ingest", hub.readSpineCoverage.hasRealityIngestions],
                  ["Evidence items", hub.readSpineCoverage.hasEvidenceItems],
                  [t("spineCoachApplicationsMemory"), hub.readSpineCoverage.hasCoachApplicationMemory],
                ] as const
              ).map(([label, on]) => (
                <span
                  key={label}
                  className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] ${
                    on ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-gray-500"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            {hub.readSpineCoverage.physiologySources ? (
              <p className="mt-2 text-xs text-gray-500">
                {t("physiologySources", {
                  profile: hub.readSpineCoverage.physiologySources.physiologicalProfile ? "✓" : "—",
                  metabolic: hub.readSpineCoverage.physiologySources.metabolicRun ? "✓" : "—",
                  lactate: hub.readSpineCoverage.physiologySources.lactateRun ? "✓" : "—",
                  maxox: hub.readSpineCoverage.physiologySources.performanceRun ? "✓" : "—",
                  biomarkers: hub.readSpineCoverage.physiologySources.biomarkerPanel ? "✓" : "—",
                })}
              </p>
            ) : null}
          </details>
          <p className="mb-2 font-mono text-[0.6rem] text-gray-500">
            {t("trainingWindow", { from: hub.window.from, to: hub.window.to })}
          </p>
          <HubRow href="/profile" title="Profile">
            {hub.profile?.line ?? t("noProfileRecord")}
          </HubRow>
          <HubRow href="/training" title="Training">
            <span>
              {t("trainingPlannedExecuted", {
                planned: hub.training.plannedCount,
                executed: hub.training.executedCount,
              })}
            </span>
            <span className="mt-2 block text-xs text-gray-400">
              {t("analyzer7d", {
                planned: hub.training.analyzerAligned.last7.planned.toFixed(0),
                executed: hub.training.analyzerAligned.last7.executed.toFixed(0),
                compliance: hub.training.analyzerAligned.last7.compliancePct.toFixed(0),
              })}
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              {t("analyzer28d", {
                planned: hub.training.analyzerAligned.last28.planned.toFixed(0),
                executed: hub.training.analyzerAligned.last28.executed.toFixed(0),
                compliance: hub.training.analyzerAligned.last28.compliancePct.toFixed(0),
                from: hub.training.analyzerAligned.fromDate,
                to: hub.training.analyzerAligned.toDate,
              })}
            </span>
            <span className="mt-2 block">
              <Pro2Link href="/training/builder" variant="secondary" className="text-xs">
                {t("openBuilder")}
              </Pro2Link>
            </span>
          </HubRow>
          <HubRow href="/nutrition" title="Nutrition">
            {hub.nutrition.constraintsLine ?? t("noNutritionConstraint")}
            {hub.nutrition.plansCount > 0 ? (
              <span className="text-gray-500"> · {t("nutritionPlans", { count: hub.nutrition.plansCount })}</span>
            ) : (
              <span className="text-gray-500"> · {t("nutritionPlans", { count: 0 })}</span>
            )}
          </HubRow>
          <HubRow href="/physiology" title="Physiology">
            {hub.physiology?.line ?? t("noPhysiologyRecent")}
          </HubRow>
          <HubRow href="/health" title="Health">
            {t("healthBiomarkerPanels", { count: hub.health.panelsCount })}
            {hub.health.lastPanelLabel ? (
              <span className="text-gray-500"> · {t("healthLastPanel", { label: hub.health.lastPanelLabel })}</span>
            ) : null}
            {hub.health.lastSampleDate ? (
              <span className="mt-1 block text-xs text-gray-500">{t("healthLastSample", { date: hub.health.lastSampleDate })}</span>
            ) : null}
            {hub.health.timelineDays != null ? (
              <span className="mt-1 block text-xs text-gray-500">{t("healthHistoryCovered", { days: hub.health.timelineDays })}</span>
            ) : null}
            {hub.health.byType.length > 0 ? (
              <span className="mt-1 block text-xs text-gray-500">
                {t("healthTypes")}{" "}
                {hub.health.byType
                  .slice(0, 5)
                  .map((row) => `${row.type} (${row.count})`)
                  .join(" · ")}
              </span>
            ) : null}
          </HubRow>
        </div>
      ) : null}
    </section>
  );
}
