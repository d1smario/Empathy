"use client";

import { SessionKnowledgeSummary } from "@/components/nutrition/SessionKnowledgeSummary";
import { Pro2GymSchedaBlockList } from "@/components/training/Pro2GymSchedaBlockList";
import type { NutritionPerformanceIntegrationDials } from "@/api/nutrition/contracts";
import {
  FUELING_CHART_THEME_PRO2,
  fuelingPhaseColor,
  round,
} from "@/lib/nutrition/nutrition-view-helpers";
import {
  FUELING_PRODUCT_CATALOG,
  type FuelingProduct,
} from "@/lib/nutrition/fueling-product-catalog";
import {
  buildIntegrationQuantityHint,
  FUELING_CATEGORY_IT,
  FUELING_FORMAT_IT,
  FOCUS_IT,
  TIMING_IT,
} from "@/lib/nutrition/integration-product-ui";
import {
  buildGlycogenPlotGeometry,
  type FuelingGlycogenDepletionModel,
} from "@/lib/nutrition/fueling-session-protocol";
import type {
  FuelingSlot,
  FuelingTrainingContextRow,
  RecoverySummaryRow,
} from "@/lib/nutrition/nutrition-view-types";

/**
 * Sezione "Fueling" di NutritionPageView (decomposizione del God-component).
 * Render puro: riceve lo stato di conferma assunzione + i suoi handler dal padre,
 * la readiness e tutte le derive già calcolate (ops cards, pacchetti seduta con
 * timeline/glicogeno, contesto training, hint knowledge, fisiologia) come props
 * read-only. Lo stato e il compute restano nel padre — qui solo presentazione.
 *
 * NB: i frammenti fueling dentro l'accordion «Dettagli e motore» (più in basso in
 * NutritionPageView) NON fanno parte di questa estrazione e restano nel padre.
 */
type FuelingTimelineStep = FuelingSlot & {
  product: FuelingProduct | undefined;
  displayImage: string;
  isLogoFallback: boolean;
  minuteOffset: number;
};

type FuelingSessionPackage = {
  id: string | number;
  title: string;
  durationMin: number;
  intensityPctFtp: number;
  choPerHourSession: number;
  timelineSteps: FuelingTimelineStep[];
  hydrationTimeline: { minuteLabel: string; note: string }[];
  visualMetrics: { label: string; value: number; unit: string; pct: number; color: string }[];
  glycogenDepletion: FuelingGlycogenDepletionModel;
  glycogenPlot: ReturnType<typeof buildGlycogenPlotGeometry>;
};

export type FuelingSectionProps = {
  athleteId: string | null;
  selectedPlanDate: string;
  fuelingConfirmBusy: boolean;
  saving: boolean;
  fuelingConfirmedForSelectedDate: boolean;
  fuelingExecutionConfirmations: Record<string, { confirmed?: boolean; at?: string }>;
  persistFuelingExecutionConfirmation: (nextConfirmed: boolean) => Promise<void>;
  fuelingReadiness: {
    ready: boolean;
    missing: string[];
    onlyDayTrainingMissing: boolean;
    hasProfileOrPhysiologyGap: boolean;
    dayTrainingAlsoMissing: boolean;
  };
  fuelingOpsCards: { label: string; value: string; unit: string; sub: string; tone: string }[];
  fuelingSessionPackages: FuelingSessionPackage[];
  recoverySummary: RecoverySummaryRow | null;
  showTech: boolean;
  fuelingTrainingContext: FuelingTrainingContextRow[];
  fuelingIntraChoSplitBySession: { id: string; label: string; choG: number }[] | null;
  knowledgeFuelingHints: { supports: string[]; risks: string[]; intents: string[] };
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials | null;
  fuelingPhysiology: { gutPathwayRisk: string };
};

export function FuelingSection({
  athleteId,
  selectedPlanDate,
  fuelingConfirmBusy,
  saving,
  fuelingConfirmedForSelectedDate,
  fuelingExecutionConfirmations,
  persistFuelingExecutionConfirmation,
  fuelingReadiness,
  fuelingOpsCards,
  fuelingSessionPackages,
  recoverySummary,
  showTech,
  fuelingTrainingContext,
  fuelingIntraChoSplitBySession,
  knowledgeFuelingHints,
  nutritionPerformanceIntegration,
  fuelingPhysiology,
}: FuelingSectionProps) {
  return (
    <section id="nutrition-fueling" className="scroll-mt-28 mb-10 space-y-4">
      <header className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <h2 className="text-lg font-bold text-white">Fueling</h2>
        <p className="mt-1 text-sm text-gray-300">
          Pre, intra and post plan for the day&apos;s session (Builder planned takes priority; if missing, uses
          duration/TSS from the imported executed workout). Summary numbers first, expandable details when needed.
        </p>
      </header>
      {athleteId ? (
        <section
          className="viz-card builder-panel border border-amber-500/25 bg-black/25 px-4 py-3 sm:px-5"
          style={{ marginBottom: 12 }}
        >
          <h3 className="viz-title text-base">Fueling intake</h3>
          <p className="mt-1 text-sm text-gray-400">
            Confirm that you followed the plan (pre / intra / post) for{" "}
            <strong className="text-white">{selectedPlanDate}</strong>. The confirmation is saved and can support
            the plan vs actual comparison if you enable nutrition adherence on the meal plan.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-nutrition-cta"
              disabled={fuelingConfirmBusy || saving}
              onClick={() => void persistFuelingExecutionConfirmation(!fuelingConfirmedForSelectedDate)}
            >
              {fuelingConfirmBusy
                ? "Saving…"
                : fuelingConfirmedForSelectedDate
                  ? "Undo confirmation for this day"
                  : "I confirm fueling intake for this day"}
            </button>
            {fuelingConfirmedForSelectedDate ? (
              <span className="text-xs text-emerald-300">
                Confirmed
                {fuelingExecutionConfirmations[selectedPlanDate]?.at
                  ? ` · ${new Date(fuelingExecutionConfirmations[selectedPlanDate]!.at!).toLocaleString("en-US")}`
                  : null}
              </span>
            ) : (
              <span className="text-xs text-gray-500">No confirmation for this date.</span>
            )}
          </div>
        </section>
      ) : null}
      <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
        <div className="nutrition-section-head">
          <h3 className="viz-title">Fueling plan · pre / intra / post</h3>
        </div>
        {!fuelingReadiness.ready ? (
          <div className="alert-warning" style={{ marginBottom: 0 }}>
            <p className="m-0 mb-2">
              <strong>Still missing:</strong> {fuelingReadiness.missing.join(", ")}.
            </p>
            {fuelingReadiness.onlyDayTrainingMissing ? (
              <p className="m-0 text-sm leading-relaxed opacity-95">
                For the date above the module finds no workout in the loaded period: no row in{" "}
                <strong>Training → Calendar</strong> and no <strong>executed workout</strong> with that date.
                Fueling is tied to the <strong>day</strong>: move the date or add/import the session —
                this is not a Physiology problem.
              </p>
            ) : (
              <>
                {fuelingReadiness.hasProfileOrPhysiologyGap ? (
                  <p className="m-0 text-sm leading-relaxed opacity-95">
                    Without the elements above (profile and physiology for fueling) we do not estimate CHO/h and lactate
                    with made-up numbers. Fill them in under <strong>Profile</strong> and <strong>Physiology</strong>.
                  </p>
                ) : null}
                {fuelingReadiness.dayTrainingAlsoMissing ? (
                  <p
                    className={`m-0 text-sm leading-relaxed opacity-95 ${fuelingReadiness.hasProfileOrPhysiologyGap ? "mt-2" : ""}`}
                  >
                    On top of that you need a <strong>workout for that day</strong> (planned in the calendar or
                    imported as executed), otherwise there is no session to compute pre/intra/post on.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Contesto e motore (coach/admin): spostato nell'accordion «Dettagli e motore» in fondo pagina. */}
            <div className="fueling-main-kpi-grid" style={{ marginBottom: "10px" }}>
              {fuelingOpsCards.map((card) => (
                <div key={card.label} className={`fueling-main-kpi-card fueling-main-kpi-card--${card.tone}`}>
                  <div className="fueling-main-kpi-label">
                    {card.label}
                  </div>
                  <div className="fueling-main-kpi-value font-mono tabular-nums">
                    {card.value}
                    {card.unit ? <span>{card.unit}</span> : null}
                  </div>
                  <div className="fueling-main-kpi-sub">{card.sub}</div>
                </div>
              ))}
            </div>
            {fuelingSessionPackages.length ? (
              <section className="fueling-visible-plan-strip" aria-label="Visible fueling plan">
                {fuelingSessionPackages.map((pkg) => (
                  <article key={`fueling-visible-plan-${pkg.id}`} className="fueling-visible-plan-card">
                    <span className="fueling-visible-plan-kicker">Fueling plan</span>
                    <strong>{pkg.title}</strong>
                    <small>
                      ~{pkg.durationMin} min · {round(pkg.intensityPctFtp)}% FTP · CHO/h ~{pkg.choPerHourSession} g/h
                    </small>
                  </article>
                ))}
              </section>
            ) : null}
            {recoverySummary?.status === "poor" || recoverySummary?.status === "moderate" ? (
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>Recovery notes</summary>
                <div className="alert-warning" style={{ marginBottom: 0 }}>
                  {recoverySummary.status === "poor"
                    ? "Low recovery: favor a simpler, progressive fueling approach, watch GI tolerance and avoid needless aggressiveness during the day."
                    : "Intermediate recovery: keep an eye on fueling density, hydration and the post-workout window."}
                </div>
              </details>
            ) : null}
            {showTech && fuelingTrainingContext.length ? (
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>Session and substrate analysis</summary>
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                {fuelingTrainingContext.map((session) => {
                  const intraSplitRow = fuelingIntraChoSplitBySession?.find((x) => String(x.id) === String(session.id));
                  return (
                  <article
                    key={session.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      padding: 12,
                      background: "rgba(9, 11, 16, 0.72)",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <strong>{session.title}</strong>
                      <span style={{ opacity: 0.72, fontSize: 12 }}>{session.family ?? "session"}</span>
                    </div>
                    <div style={{ color: "var(--empathy-text-muted)", fontSize: 12 }}>
                      {session.discipline ?? "training"} · {session.durationMin} min · {session.tss} TSS
                      {session.kcal ? ` · ~${Math.round(session.kcal)} kcal` : null}
                    </div>
                    {session.substrate ? (
                      <div style={{ color: "var(--empathy-text-muted)", fontSize: 11, lineHeight: 1.45 }}>
                        <strong>Substrates (engine estimate):</strong> induced intensity ~{session.substrate.estimatedIntensityPctFtp}% FTP · lact
                        ~{session.substrate.lactateProducedG} g · Cori glucose ~{session.substrate.glucoseFromCoriG} g (net{" "}
                        ~{session.substrate.glucoseNetFromCoriG} g) · exogenous CHO oxidized ~{session.substrate.exogenousOxidizedG} g · CHO
                        available ~{session.substrate.choAvailableG} g · CHO energy share ~{session.substrate.glycolyticSharePct}% ·
                        gut pathway risk: {session.substrate.gutPathwayRisk} · blood delivery ~{session.substrate.bloodDeliveryPctOfIngested}%
                      </div>
                    ) : null}
                    {intraSplitRow ? (
                      <div style={{ color: "var(--empathy-text-muted)", fontSize: 11 }}>
                        <strong>Intra CHO share (day split):</strong> ~{intraSplitRow.choG} g
                      </div>
                    ) : null}
                    {session.target ? (
                      <div style={{ fontSize: 12 }}>
                        <strong>Target:</strong> {session.target}
                      </div>
                    ) : null}
                    {session.intensityCues.length ? (
                      <div style={{ fontSize: 12 }}>
                        <strong>Intensity:</strong> {session.intensityCues.join(" · ")}
                      </div>
                    ) : null}
                    {session.blockLabels.length ? (
                      <div style={{ fontSize: 12 }}>
                        <strong>Blocks:</strong> {session.blockLabels.join(" · ")}
                      </div>
                    ) : null}
                    {session.family === "strength" && session.builderContract ? (
                      <details className="mt-2" open>
                        <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Gym program (Builder) · intra workout
                        </summary>
                        <div style={{ marginTop: 8 }}>
                          <Pro2GymSchedaBlockList contract={session.builderContract} compact />
                        </div>
                      </details>
                    ) : null}
                    {session.physiologicalIntent.length ? (
                      <div style={{ fontSize: 12 }}>
                        <strong>Intent:</strong> {session.physiologicalIntent.join(" · ")}
                      </div>
                    ) : null}
                    {session.nutritionSupports.length ? (
                      <div style={{ fontSize: 12 }}>
                        <strong>Supports:</strong> {session.nutritionSupports.join(" · ")}
                      </div>
                    ) : null}
                    {session.inhibitorsAndRisks.length ? (
                      <div style={{ fontSize: 12 }}>
                        <strong>Risks:</strong> {session.inhibitorsAndRisks.join(" · ")}
                      </div>
                    ) : null}
                    <SessionKnowledgeSummary contract={session.builderContract} compact />
                  </article>
                  );
                })}
                </section>
              </details>
            ) : null}
            {knowledgeFuelingHints.intents.length || knowledgeFuelingHints.supports.length || knowledgeFuelingHints.risks.length ? (
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>Fueling context from evidence</summary>
                <div style={{ display: "grid", gap: 8 }}>
                  {knowledgeFuelingHints.intents.length ? (
                    <div className="session-sub-copy">
                      Physiological intent · {knowledgeFuelingHints.intents.join(" · ")}
                    </div>
                  ) : null}
                  {knowledgeFuelingHints.supports.length ? (
                    <div className="session-sub-copy">
                      Priority supports · {knowledgeFuelingHints.supports.join(" · ")}
                    </div>
                  ) : null}
                  {knowledgeFuelingHints.risks.length ? (
                    <div className="muted-copy">
                      Constraints and risks · {knowledgeFuelingHints.risks.join(" · ")}
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
            {fuelingSessionPackages.map((pkg) => {
              const glyId = `glycoArea-${String(pkg.id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
              const gPlot = pkg.glycogenPlot;
              const gDep = pkg.glycogenDepletion;
              return (
                <details
                  key={`fuel-pkg-${pkg.id}`}
                  className="collapsible-card"
                  style={{
                    marginBottom: 20,
                    paddingBottom: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <summary>{pkg.title}</summary>
                  <p className="nutrition-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    ~{pkg.durationMin} min · estimated intensity ~{round(pkg.intensityPctFtp)}% FTP · session CHO/h ~{pkg.choPerHourSession} g/h
                  </p>
                  <div className="fueling-vertical-timeline">
                    {pkg.timelineSteps.map((step, idx) => (
                      <article key={`step-${pkg.id}-${step.phase}-${step.time}-${idx}`} className="fueling-vstep">
                        {(() => {
                          const phaseColor = fuelingPhaseColor(step.phase);
                          return (
                            <>
                              <div className="fueling-vrail">
                                <span
                                  className="fueling-vdot"
                                  style={{
                                    background: `${phaseColor}22`,
                                    border: `1px solid ${phaseColor}`,
                                    color: phaseColor,
                                  }}
                                >
                                  {idx + 1}
                                </span>
                                {idx < pkg.timelineSteps.length - 1 && (
                                  <span className="fueling-vline" style={{ background: `${phaseColor}66` }} />
                                )}
                              </div>
                              <div
                                className="fueling-vcard grid grid-cols-1 sm:grid-cols-2"
                                style={{
                                  overflow: "hidden",
                                  borderRadius: 12,
                                  border: "1px solid rgba(167,139,250,0.28)",
                                  background: "linear-gradient(135deg, rgba(76,29,149,0.2), rgba(0,0,0,0.45))",
                                }}
                              >
                                <div
                                  className="fueling-step-body border-b border-white/[0.08] pr-0 sm:border-b-0 sm:border-r sm:pr-2.5"
                                >
                                  <span
                                    className="fueling-step-time"
                                    style={{
                                      color: phaseColor,
                                      border: `1px solid ${phaseColor}`,
                                      background: `${phaseColor}22`,
                                      borderRadius: "999px",
                                      padding: "2px 8px",
                                      display: "inline-block",
                                    }}
                                  >
                                    {step.phase} · {step.time}
                                  </span>
                                  <strong>{step.product?.product ?? "Fuel product"}</strong>
                                  <small>{step.product?.brand ?? "Brand"}</small>
                                  <div className="fueling-step-chip-row">
                                    <span>CHO {step.cho}g</span>
                                    <span>Fluid {step.fluid}ml</span>
                                    {step.product?.format ? <span>{FUELING_FORMAT_IT[step.product.format]}</span> : null}
                                    {step.product?.category ? <span>{FUELING_CATEGORY_IT[step.product.category]}</span> : null}
                                    {step.product?.functionalFocus?.[0] ? <span>{FOCUS_IT[step.product.functionalFocus[0]] ?? step.product.functionalFocus[0]}</span> : null}
                                    {step.product?.timing?.[0] ? <span>{TIMING_IT[step.product.timing[0]] ?? step.product.timing[0]}</span> : null}
                                  </div>
                                  <p className="muted-copy" style={{ fontSize: 11, margin: "8px 0 0", lineHeight: 1.4 }}>
                                    {buildIntegrationQuantityHint(step.product ?? FUELING_PRODUCT_CATALOG[0], {
                                      choGHour: pkg.choPerHourSession,
                                      energyAdequacyRatio: nutritionPerformanceIntegration?.diaryInsight?.energyAdequacyRatio,
                                      proteinBiasPctPoints: nutritionPerformanceIntegration?.proteinBiasPctPoints ?? 0,
                                      fuelingChoScale: nutritionPerformanceIntegration?.fuelingChoScale ?? 1,
                                    })}
                                  </p>
                                  <div className="fueling-step-actions">
                                    <a
                                      href={step.product?.productUrl ?? "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="fueling-step-link"
                                    >
                                      Manufacturer page
                                    </a>
                                  </div>
                                </div>
                                <a
                                  href={step.product?.productUrl ?? "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="fueling-step-media-link flex items-center justify-center"
                                  aria-label={step.product?.product ?? "Fueling product"}
                                  title={step.isLogoFallback ? "Brand logo fallback" : "Catalog / archive image"}
                                  style={{ minHeight: 132, background: "rgba(0,0,0,0.28)", padding: 10, position: "relative" }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={step.displayImage}
                                    alt={step.product?.product ?? "Fuel product"}
                                    className={`nutrition-product-image ${step.isLogoFallback ? "nutrition-product-image-logo" : ""}`}
                                    style={{ maxHeight: 112, width: "100%", objectFit: "contain" }}
                                    loading="lazy"
                                  />
                                  {step.isLogoFallback ? (
                                    <span
                                      style={{
                                        position: "absolute",
                                        bottom: 8,
                                        right: 8,
                                        borderRadius: 4,
                                        background: "rgba(0,0,0,0.55)",
                                        padding: "2px 6px",
                                        fontSize: "0.58rem",
                                        color: "#94a3b8",
                                      }}
                                    >
                                      Logo
                                    </span>
                                  ) : null}
                                </a>
                              </div>
                            </>
                          );
                        })()}
                      </article>
                    ))}
                  </div>

                  <details className="collapsible-card">
                    <summary>Hydration protocol · {pkg.title}</summary>
                    <section className="fueling-hydration-strip" style={{ marginBottom: 0 }}>
                      <div className="fueling-hydration-grid">
                        {pkg.hydrationTimeline.map((h) => (
                          <div key={`hydration-${pkg.id}-${h.minuteLabel}`} className="fueling-hydration-chip">
                            <strong>{h.minuteLabel}</strong>
                            <span>{h.note}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </details>

                  <section className="fueling-visual-report">
                    <h4>Fueling report · {pkg.title}</h4>
                    <div className="fueling-metric-grid">
                      {pkg.visualMetrics.map((metric) => (
                        <article key={`${pkg.id}-${metric.label}`} className="fueling-metric-card">
                          <div className="fueling-metric-head">
                            <label>{metric.label}</label>
                            <strong>
                              {metric.value} {metric.unit}
                            </strong>
                          </div>
                          <div className="fueling-metric-bar">
                            <div className="fueling-metric-fill" style={{ width: `${metric.pct}%`, background: metric.color }} />
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="fueling-glyco-future">
                      <h5>Glycogen depletion (session)</h5>
                      <div className="nutrition-detail-rail" style={{ marginBottom: "8px" }}>
                        <span>
                          <strong>Intake raw:</strong> {gDep.totalIntake} g
                        </span>
                        <span>
                          <strong>Absorbed:</strong> {gDep.totalAbsorbed} g
                        </span>
                        <span>
                          <strong>Cori:</strong> {gDep.totalCori} g
                        </span>
                        <span>
                          <strong>Gut risk:</strong> {fuelingPhysiology.gutPathwayRisk}
                        </span>
                      </div>
                      <svg viewBox={`0 0 ${gPlot.w} ${gPlot.h}`} className="fueling-glyco-svg">
                        <defs>
                          <linearGradient id={glyId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={FUELING_CHART_THEME_PRO2.areaTop} stopOpacity="0.45" />
                            <stop offset="100%" stopColor={FUELING_CHART_THEME_PRO2.areaBottom} stopOpacity="0.04" />
                          </linearGradient>
                        </defs>
                        <rect
                          x={gPlot.padL}
                          y={gPlot.padT}
                          width={gPlot.chartW}
                          height={gPlot.chartH}
                          fill="rgba(255,255,255,0.02)"
                          rx="8"
                        />
                        <rect
                          x={gPlot.padL}
                          y={gPlot.toY(100)}
                          width={gPlot.chartW}
                          height={gPlot.toY(60) - gPlot.toY(100)}
                          fill={FUELING_CHART_THEME_PRO2.zoneGreen}
                        />
                        <rect
                          x={gPlot.padL}
                          y={gPlot.toY(60)}
                          width={gPlot.chartW}
                          height={gPlot.toY(30) - gPlot.toY(60)}
                          fill={FUELING_CHART_THEME_PRO2.zoneYellow}
                        />
                        <rect
                          x={gPlot.padL}
                          y={gPlot.toY(30)}
                          width={gPlot.chartW}
                          height={gPlot.toY(0) - gPlot.toY(30)}
                          fill={FUELING_CHART_THEME_PRO2.zoneRed}
                        />
                        <path d={gPlot.areaPath} fill={`url(#${glyId})`} />
                        <path fill="none" stroke={FUELING_CHART_THEME_PRO2.line} strokeWidth="3" d={gPlot.smoothPath} />
                        {gDep.points.map((p) => (
                          <circle
                            key={`g-${pkg.id}-${p.xHour}-${p.pct}`}
                            cx={gPlot.toX(p.xHour)}
                            cy={gPlot.toY(p.pct)}
                            r="4"
                            fill={FUELING_CHART_THEME_PRO2.dot}
                          />
                        ))}
                        <line
                          x1={gPlot.padL}
                          y1={gPlot.toY(60)}
                          x2={gPlot.w - gPlot.padR}
                          y2={gPlot.toY(60)}
                          stroke="rgba(103,232,249,0.5)"
                          strokeDasharray="4 6"
                        />
                        <line
                          x1={gPlot.padL}
                          y1={gPlot.toY(30)}
                          x2={gPlot.w - gPlot.padR}
                          y2={gPlot.toY(30)}
                          stroke="rgba(248,113,113,0.55)"
                          strokeDasharray="4 6"
                        />
                        <line
                          x1={gPlot.padL}
                          y1={gPlot.padT}
                          x2={gPlot.padL}
                          y2={gPlot.h - gPlot.padB}
                          stroke={FUELING_CHART_THEME_PRO2.axis}
                        />
                        <line
                          x1={gPlot.padL}
                          y1={gPlot.h - gPlot.padB}
                          x2={gPlot.w - gPlot.padR}
                          y2={gPlot.h - gPlot.padB}
                          stroke={FUELING_CHART_THEME_PRO2.axis}
                        />
                        {[100, 80, 60, 40, 30, 20, 0].map((pct) => (
                          <text key={`y-${pkg.id}-${pct}`} x={8} y={gPlot.toY(pct) + 4} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">
                            {pct}% · {round((gDep.totalGlycogen * pct) / 100)}g
                          </text>
                        ))}
                        {Array.from({ length: Math.floor(gDep.totalHours) + 1 }, (_, i) => i).map((hTick) => (
                          <text key={`x-${pkg.id}-${hTick}`} x={gPlot.toX(hTick) - 8} y={gPlot.h - 8} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">
                            {hTick}h
                          </text>
                        ))}
                        <text x={gPlot.w - 188} y={16} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">
                          Y: available glycogen (g / %)
                        </text>
                        <text x={gPlot.w - 118} y={gPlot.h - 8} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">
                          X: time
                        </text>
                      </svg>
                    </div>
                  </section>
                </details>
              );
            })}
          </>
        )}
      </section>
    </section>
  );
}
