"use client";

import { useTranslations } from "next-intl";
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
  glycogenDepletion: FuelingGlycogenDepletionModel;
  glycogenPlot: ReturnType<typeof buildGlycogenPlotGeometry>;
};

export type FuelingSectionProps = {
  athleteId: string | null;
  selectedPlanDate: string;
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
  /**
   * Diario eliminato (2026-07): il consuntivo vive nel Piano.
   * - "protocol": protocollo pre/intra/post + conferma assunzione, senza header (Piano);
   * - "full" (default): tutto, comportamento storico (pagina fueling legacy).
   */
  mode?: "full" | "protocol";
};

export function FuelingSection({
  athleteId,
  selectedPlanDate,
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
  mode = "full",
}: FuelingSectionProps) {
  const t = useTranslations("FuelingSection");

  return (
    <section id="nutrition-fueling" className="scroll-mt-28 mb-10 space-y-4">
      {/* Nel Piano (mode="protocol") niente banner introduttivo: il pannello sotto
          ha già il titolo «Piano rifornimento · pre / intra / post» — era un doppione. */}
      {mode === "full" ? (
        <header className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <h2 className="text-lg font-bold text-white">{t("heading")}</h2>
          <p className="mt-1 text-sm text-gray-300">
            {t("intro")}
          </p>
        </header>
      ) : null}
      {/* Conferma «Assunzione rifornimento» RIMOSSA (feedback 2026-07):
          doppione della conferma per pasto del carosello. */}
      <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
        <div className="nutrition-section-head">
          <h3 className="viz-title">{t("planTitle")}</h3>
        </div>
        {!fuelingReadiness.ready ? (
          <div className="alert-warning" style={{ marginBottom: 0 }}>
            <p className="m-0 mb-2">
              <strong>{t("stillMissing")}</strong> {fuelingReadiness.missing.join(", ")}.
            </p>
            {fuelingReadiness.onlyDayTrainingMissing ? (
              <p className="m-0 text-sm leading-relaxed opacity-95">
                {t.rich("noWorkoutNote", {
                  b1: (chunks) => <strong>{chunks}</strong>,
                  b2: (chunks) => <strong>{chunks}</strong>,
                  b3: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            ) : (
              <>
                {fuelingReadiness.hasProfileOrPhysiologyGap ? (
                  <p className="m-0 text-sm leading-relaxed opacity-95">
                    {t.rich("profileGapNote", {
                      b1: (chunks) => <strong>{chunks}</strong>,
                      b2: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </p>
                ) : null}
                {fuelingReadiness.dayTrainingAlsoMissing ? (
                  <p
                    className={`m-0 text-sm leading-relaxed opacity-95 ${fuelingReadiness.hasProfileOrPhysiologyGap ? "mt-2" : ""}`}
                  >
                    {t.rich("dayWorkoutNote", {
                      b: (chunks) => <strong>{chunks}</strong>,
                    })}
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
            {/* Strip «Piano integrazione» RIMOSSA (feedback 2026-07): ripeteva
                titolo e sottotitolo dell'accordion seduta subito sotto. */}
            {recoverySummary?.status === "poor" || recoverySummary?.status === "moderate" ? (
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>{t("recoveryNotesSummary")}</summary>
                <div className="alert-warning" style={{ marginBottom: 0 }}>
                  {recoverySummary.status === "poor"
                    ? t("recoveryPoor")
                    : t("recoveryModerate")}
                </div>
              </details>
            ) : null}
            {showTech && fuelingTrainingContext.length ? (
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>{t("sessionSubstrateSummary")}</summary>
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
                        {t.rich("substratesLine", {
                          b: (chunks) => <strong>{chunks}</strong>,
                          intensity: session.substrate.estimatedIntensityPctFtp,
                          lact: session.substrate.lactateProducedG,
                          cori: session.substrate.glucoseFromCoriG,
                          coriNet: session.substrate.glucoseNetFromCoriG,
                          exo: session.substrate.exogenousOxidizedG,
                          choAvail: session.substrate.choAvailableG,
                          share: session.substrate.glycolyticSharePct,
                          gutRisk: session.substrate.gutPathwayRisk,
                          delivery: session.substrate.bloodDeliveryPctOfIngested,
                        })}
                      </div>
                    ) : null}
                    {intraSplitRow ? (
                      <div style={{ color: "var(--empathy-text-muted)", fontSize: 11 }}>
                        <strong>{t("intraChoLabel")}</strong> ~{intraSplitRow.choG} g
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
                          {t("gymProgramSummary")}
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
            {/* «Contesto rifornimento dalle evidenze»: gergo motore (modello
                lattato, quota energetica stimata) — solo staff (2026-07). */}
            {showTech &&
            (knowledgeFuelingHints.intents.length || knowledgeFuelingHints.supports.length || knowledgeFuelingHints.risks.length) ? (
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>{t("fuelingContextSummary")}</summary>
                <div style={{ display: "grid", gap: 8 }}>
                  {knowledgeFuelingHints.intents.length ? (
                    <div className="session-sub-copy">
                      {t("physiologicalIntentLabel")} · {knowledgeFuelingHints.intents.join(" · ")}
                    </div>
                  ) : null}
                  {knowledgeFuelingHints.supports.length ? (
                    <div className="session-sub-copy">
                      {t("prioritySupportsLabel")} · {knowledgeFuelingHints.supports.join(" · ")}
                    </div>
                  ) : null}
                  {knowledgeFuelingHints.risks.length ? (
                    <div className="muted-copy">
                      {t("constraintsRisksLabel")} · {knowledgeFuelingHints.risks.join(" · ")}
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
                  open
                  style={{
                    marginBottom: 20,
                    paddingBottom: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <summary>{pkg.title}</summary>
                  <p className="nutrition-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    {t("packageMeta", {
                      duration: pkg.durationMin,
                      intensity: round(pkg.intensityPctFtp),
                      cho: pkg.choPerHourSession,
                    })}
                  </p>
                  <div className="fueling-vertical-timeline">
                    {pkg.timelineSteps.map((step, idx) => (
                      <article key={`step-${pkg.id}-${step.phase}-${step.time}-${idx}`} className="fueling-vstep">
                        {(() => {
                          const phaseColor = fuelingPhaseColor(step.phase);
                          const mediaInner = (
                            <>
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
                            </>
                          );
                          const mediaStyle = {
                            minHeight: 132,
                            background: "rgba(0,0,0,0.28)",
                            padding: 10,
                            position: "relative" as const,
                          };
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
                                    {/* Chip dedup (feedback 2026-07: «Recovery Recovery», «Gel Gel»);
                                        niente chip timing — la fase è già nella pillola dello step. */}
                                    {[
                                      `CHO ${step.cho}g`,
                                      `${t("chipFluid")} ${step.fluid}ml`,
                                      step.product?.format ? FUELING_FORMAT_IT[step.product.format] : null,
                                      step.product?.category ? FUELING_CATEGORY_IT[step.product.category] : null,
                                      step.product?.functionalFocus?.[0]
                                        ? FOCUS_IT[step.product.functionalFocus[0]] ?? step.product.functionalFocus[0]
                                        : null,
                                    ]
                                      .filter((chip): chip is string => Boolean(chip))
                                      .filter((chip, idx, arr) => arr.indexOf(chip) === idx)
                                      .map((chip) => (
                                        <span key={chip}>{chip}</span>
                                      ))}
                                  </div>
                                  <p className="muted-copy" style={{ fontSize: 11, margin: "8px 0 0", lineHeight: 1.4 }}>
                                    {buildIntegrationQuantityHint(step.product ?? FUELING_PRODUCT_CATALOG[0], {
                                      choGHour: pkg.choPerHourSession,
                                      energyAdequacyRatio: nutritionPerformanceIntegration?.diaryInsight?.energyAdequacyRatio,
                                      proteinBiasPctPoints: nutritionPerformanceIntegration?.proteinBiasPctPoints ?? 0,
                                      fuelingChoScale: nutritionPerformanceIntegration?.fuelingChoScale ?? 1,
                                    })}
                                  </p>
                                </div>
                                <div
                                  className="fueling-step-media-link flex items-center justify-center"
                                  aria-label={step.product?.product ?? t("fuelingProductAria")}
                                  title={step.isLogoFallback ? t("brandLogoFallbackTitle") : t("catalogArchiveTitle")}
                                  style={mediaStyle}
                                >
                                  {mediaInner}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </article>
                    ))}
                  </div>

                  {/* Accordion «Hydration protocol» (chip identiche «500ml + mineral
                      salts» ogni 20') e barre report RIMOSSI (feedback 2026-07):
                      doppioni delle KPI in testa e dei liquidi già in ogni step. */}
                  <section className="fueling-visual-report">
                    <div className="fueling-glyco-future">
                      <h5>{t("glycogenDepletionTitle")}</h5>
                      {/* Una frase leggibile al posto del rail tecnico
                          («Intake raw / Cori / Gut risk» era gergo motore in EN). */}
                      <p className="nutrition-muted" style={{ fontSize: 12, margin: "0 0 8px", lineHeight: 1.5 }}>
                        {t("glycogenIntakeLine", {
                          intake: gDep.totalIntake,
                          absorbed: gDep.totalAbsorbed,
                          gutRisk:
                            fuelingPhysiology.gutPathwayRisk === "low"
                              ? t("gutRiskLow")
                              : fuelingPhysiology.gutPathwayRisk === "high"
                                ? t("gutRiskHigh")
                                : t("gutRiskModerate"),
                        })}
                      </p>
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
                          {t("axisYLabel")}
                        </text>
                        <text x={gPlot.w - 118} y={gPlot.h - 8} fill={FUELING_CHART_THEME_PRO2.text} fontSize="10">
                          {t("axisXLabel")}
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
