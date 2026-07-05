"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { pathwayOperationalPhaseRowClass } from "@/lib/nutrition/nutrition-view-helpers";
import {
  FUELING_CATEGORY_IT,
  FUELING_FORMAT_IT,
  FOCUS_IT,
  hasProductDatasheetUrl,
  TIMING_IT,
  type IntegrationTimingBucket,
} from "@/lib/nutrition/integration-product-ui";
import type { FuelingProduct } from "@/lib/nutrition/fueling-product-catalog";
import type {
  FunctionalFoodRecommendationsViewModel,
  NutritionPathwayModulationViewModel,
  NutrientInterrogationViewModel,
  NutritionPerformanceIntegrationDials,
} from "@/api/nutrition/contracts";
import type { CrossDomainInterpretationRoadmap } from "@empathy/contracts";

/**
 * Sezione "Integrazione" di NutritionPageView (decomposizione del God-component).
 * Render puro. La card prodotto è esportata: la usa anche la FuelingSection per
 * lo «stack per timing» (fusione rifornimento+integrazione, 2026-07).
 */
export type IntegrationProductCardProduct = FuelingProduct & {
  displayImage: string;
  isLogoFallback: boolean;
  /** Etichette umane dei target del giorno coperti dal prodotto (motore pathway ∩ nutrient_targets DB). */
  recommendedTodayLabels?: string[];
};

export function IntegrationProductCard({
  product,
  qtyHint,
  accent,
}: {
  product: IntegrationProductCardProduct;
  qtyHint: string;
  accent: IntegrationTimingBucket | "daily";
}) {
  const t = useTranslations("IntegrationSection");
  const metaChips = [
    FUELING_FORMAT_IT[product.format],
    FUELING_CATEGORY_IT[product.category],
    ...product.functionalFocus.map((f) => FOCUS_IT[f] ?? f),
  ];
  const accentBorder =
    accent === "pre"
      ? "rgba(167,139,250,0.55)"
      : accent === "intra"
        ? "rgba(232,121,249,0.5)"
        : accent === "daily"
          ? "rgba(34,211,238,0.45)"
          : "rgba(251,146,60,0.5)";
  // Link «Scheda produttore» solo se pagina prodotto reale, mai homepage (feedback 2026-07).
  const datasheetUrl = hasProductDatasheetUrl(product.productUrl) ? product.productUrl : null;
  return (
    <article
      className="grid grid-cols-1 sm:grid-cols-2"
      style={{
        minHeight: 168,
        overflow: "hidden",
        borderRadius: 12,
        border: `1px solid ${accentBorder}`,
        background: "linear-gradient(135deg, rgba(76,29,149,0.18), rgba(0,0,0,0.55))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="border-b border-white/[0.08] sm:border-b-0 sm:border-r"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "12px 14px",
        }}
      >
        <div>
          {product.recommendedTodayLabels?.length ? (
            <span
              style={{
                display: "inline-block",
                marginBottom: 6,
                borderRadius: 999,
                border: "1px solid rgba(52,211,153,0.5)",
                background: "rgba(6,78,59,0.45)",
                padding: "2px 8px",
                fontSize: "0.62rem",
                fontWeight: 600,
                color: "#6ee7b7",
              }}
            >
              {t("recommendedToday")} · {product.recommendedTodayLabels.join(", ")}
            </span>
          ) : null}
          <div className="nutrition-product-brand" style={{ fontSize: "0.65rem", letterSpacing: "0.08em" }}>
            {product.brand}
          </div>
          <strong style={{ display: "block", marginTop: 6, fontSize: "1rem", lineHeight: 1.25 }}>{product.product}</strong>
          <p className="nutrition-muted" style={{ margin: "10px 0 0", fontSize: "0.72rem", lineHeight: 1.45 }}>
            {qtyHint}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {metaChips.map((chip) => (
              <span
                key={`${product.brand}-${product.product}-m-${chip}`}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.06)",
                  padding: "2px 8px",
                  fontSize: "0.62rem",
                  color: "var(--empathy-text-muted, #cbd5e1)",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {product.timing.map((timing) => (
              <span
                key={`${product.brand}-${product.product}-t-${timing}`}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(34,211,238,0.35)",
                  background: "rgba(6,78,95,0.35)",
                  padding: "2px 8px",
                  fontSize: "0.62rem",
                  color: "#a5f3fc",
                }}
              >
                {TIMING_IT[timing] ?? timing}
              </span>
            ))}
          </div>
        </div>
        {datasheetUrl ? (
          <a
            href={datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nutrition-product-link"
            style={{ marginTop: 12, fontSize: "0.68rem", fontWeight: 600 }}
          >
            {t("manufacturerSheet")}
          </a>
        ) : null}
      </div>
      {(() => {
        const mediaStyle = {
          position: "relative" as const,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 140,
          background: "rgba(0,0,0,0.35)",
          padding: 12,
        };
        const mediaTitle = product.isLogoFallback ? t("brandLogoFallback") : t("catalogArchiveImage");
        const mediaInner = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.displayImage}
              alt={product.product}
              className={`nutrition-product-image ${product.isLogoFallback ? "nutrition-product-image-logo" : ""}`}
              style={{ maxHeight: 132, width: "100%", objectFit: "contain" }}
              loading="lazy"
            />
            {product.isLogoFallback ? (
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
        return datasheetUrl ? (
          <a
            href={datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nutrition-product-media-link"
            style={mediaStyle}
            title={mediaTitle}
          >
            {mediaInner}
          </a>
        ) : (
          <div className="nutrition-product-media-link" style={mediaStyle} title={mediaTitle}>
            {mediaInner}
          </div>
        );
      })()}
    </article>
  );
}

/**
 * Snellita (analisi 2026-07): restano SOLO i blocchi che guidano il piano
 * (vie metaboliche → nutrientBoostTargets; target alimenti funzionali) più le
 * leve performance (spiegano le modulazioni) e i pannelli tech coach/admin.
 * Rimossi: KPI dynamics/stack (ridondanti), playbook display (entra nel piano
 * solo come note), selettore pasti funzionali, esempi curati + ricerche USDA,
 * card prodotti (fuse nel Rifornimento come «stack per timing»).
 */
export type IntegrationSectionProps = {
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials | null;
  showTech: boolean;
  crossDomainInterpretationRoadmap: CrossDomainInterpretationRoadmap | null;
  nutrientInterrogation: NutrientInterrogationViewModel | null;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  selectedPlanDateLabel: string;
  functionalFoodRecommendations: FunctionalFoodRecommendationsViewModel;
};

export function IntegrationSection({
  nutritionPerformanceIntegration,
  showTech,
  crossDomainInterpretationRoadmap,
  nutrientInterrogation,
  pathwayModulation,
  selectedPlanDateLabel,
  functionalFoodRecommendations,
}: IntegrationSectionProps) {
  const t = useTranslations("IntegrationSection");
  return (
          <section id="nutrition-integration" className="scroll-mt-28 mb-10 space-y-4">
            <header className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <h2 className="text-lg font-bold text-white">{t("integrationTitle")}</h2>
              <p className="mt-1 text-sm text-gray-400">{t("integrationSubtitle")}</p>
            </header>
            <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
              <h3 className="viz-title">{t("integrationTitle")}</h3>
              {nutritionPerformanceIntegration?.rationale.length ? (
                <details
                  className="collapsible-card"
                  style={{ marginBottom: "10px", padding: "10px 12px", borderColor: "rgba(251,191,36,0.35)" }}
                >
                  <summary className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-amber-400">
                    {t("performanceIntegrationLevers", { count: nutritionPerformanceIntegration.rationale.length })}
                  </summary>
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", lineHeight: 1.45 }}>
                    {nutritionPerformanceIntegration.rationale.map((line) => (
                      <li key={line} style={{ marginBottom: "4px" }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {nutritionPerformanceIntegration?.diaryInsight ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>
                    {t("realDiaryDays", {
                      logged: nutritionPerformanceIntegration.diaryInsight.loggedDays,
                      window: nutritionPerformanceIntegration.diaryInsight.windowDays,
                    })}
                    {nutritionPerformanceIntegration.diaryInsight.energyAdequacyRatio != null
                      ? ` · ${Math.round(nutritionPerformanceIntegration.diaryInsight.energyAdequacyRatio * 100)}% target`
                      : ""}
                  </summary>
                  <p className="muted-copy" style={{ fontSize: 12, marginTop: 8, marginBottom: 0, lineHeight: 1.45 }}>
                    {t("averageEnergy", { kcal: nutritionPerformanceIntegration.diaryInsight.avgDailyKcal ?? "—" })}
                    {nutritionPerformanceIntegration.diaryInsight.estimatedMaintenanceKcal != null
                      ? ` ${t("vsEstimatedRequirement", { kcal: nutritionPerformanceIntegration.diaryInsight.estimatedMaintenanceKcal })}`
                      : ""}
                    {t("signalModulates")}
                  </p>
                </details>
              ) : null}
              {showTech && crossDomainInterpretationRoadmap ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>{t("crossDomainRoadmapSummary")}</summary>
                  <p className="nutrition-muted mb-2 mt-2 text-[0.74rem] leading-snug">
                    {crossDomainInterpretationRoadmap.roadmapHeadlineIt}
                  </p>
                  <ul className="mb-3 list-none space-y-2 pl-0 text-[0.78rem]">
                    {crossDomainInterpretationRoadmap.nodes.slice(0, 8).map((node) => (
                      <li
                        key={node.domainId}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-white">{node.domainId.replace(/_/g, " ")}</strong>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.65rem] font-semibold text-gray-300">{node.probeStatus}</span>
                        </div>
                        <p className="nutrition-muted mt-1 mb-0 text-[0.74rem]">{node.summaryLineIt}</p>
                      </li>
                    ))}
                  </ul>
                  {crossDomainInterpretationRoadmap.edges.length ? (
                    <p className="nutrition-muted mb-0 text-[0.72rem]">
                      {t("activeLinks", { count: crossDomainInterpretationRoadmap.edges.length })}
                    </p>
                  ) : null}
                </details>
              ) : null}
              {showTech && nutrientInterrogation?.items.length ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>{t("nutrientInterrogationSummary")}</summary>
                  <p className="nutrition-muted mb-2 mt-2 text-[0.74rem] leading-snug">
                    {t("dominantBottleneck", { level: nutrientInterrogation.dominantBottleneckLevelIt })} · ontology{" "}
                    {nutrientInterrogation.ontologyVersion}
                  </p>
                  <ul className="mb-0 list-none space-y-2 pl-0 text-[0.78rem]">
                    {nutrientInterrogation.items.slice(0, 6).map((item) => (
                      <li
                        key={item.nutrientId}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-white">{item.labelIt}</strong>
                          {item.subDomains.slice(0, 3).map((sd) => (
                            <span key={sd} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.65rem] font-semibold text-gray-300">
                              {sd.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                        {item.geneSymbols.length ? (
                          <p className="nutrition-muted mt-1 mb-0 text-[0.72rem]">
                            {t("genesLabel", { genes: item.geneSymbols.join(", ") })}
                          </p>
                        ) : null}
                        {item.activatedNodes.length ? (
                          <p className="nutrition-muted mt-1 mb-0 text-[0.72rem]">
                            {t("nodesLabel", { nodes: item.activatedNodes.map((n) => n.labelIt).slice(0, 3).join(" · ") })}
                          </p>
                        ) : null}
                        {item.preferredSlotsIt?.length ? (
                          <p className="nutrition-muted mt-1 mb-0 text-[0.72rem]">
                            {t("preferredMeals", { meals: item.preferredSlotsIt.join(", ") })}
                          </p>
                        ) : null}
                        <p className="nutrition-muted mt-1 mb-0 text-[0.72rem]">{item.rationaleIt}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>{t("metabolicPathwaysSummary")}</summary>
                <p className="nutrition-muted mb-2 mt-2 text-[0.74rem] leading-snug">
                  {t("fourColumns")}
                </p>
                <div className="table-shell mt-2 overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full border-collapse text-left text-[0.8rem]">
                    <thead>
                      <tr className="text-[0.65rem] font-bold uppercase tracking-[0.06em]">
                        <th className="border border-white/10 bg-violet-500/25 px-3 py-2.5 text-violet-100">{t("thPathwayStimulus")}</th>
                        <th className="border border-white/10 bg-fuchsia-500/22 px-3 py-2.5 text-fuchsia-100">{t("thSignalSource")}</th>
                        <th className="border border-white/10 bg-orange-500/20 px-3 py-2.5 text-orange-100">
                          {t("thStrategy")}
                        </th>
                        <th className="border border-white/10 bg-sky-500/18 px-3 py-2.5 text-sky-100">
                          {t("thSupplementSupport")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pathwayModulation?.pathways.length ? (
                        pathwayModulation.pathways.map((pw) => (
                          <tr key={pw.id} className="align-top">
                            <td className="border border-white/10 bg-violet-500/[0.07] px-3 py-2 text-[0.8rem] text-white">
                              <strong>{pw.pathwayLabel}</strong>
                              <div className="nutrition-muted mt-1 text-[0.74rem]">
                                {pw.stimulatedBy.length ? pw.stimulatedBy.join(", ") : "—"}
                              </div>
                            </td>
                            <td className="border border-white/10 bg-fuchsia-500/[0.06] px-3 py-2 text-[0.78rem] text-gray-200">
                              {pw.confidence}
                            </td>
                            <td className="border border-white/10 bg-orange-500/[0.08] px-3 py-2 text-[0.78rem] text-gray-100">
                              {pw.substrates.join("; ")}
                            </td>
                            <td className="border border-white/10 bg-sky-500/[0.07] px-3 py-2 text-[0.78rem] text-gray-100">
                              <span className="mb-1 block">
                                <strong>{t("cofactors")}</strong> {pw.cofactors.join("; ") || "—"}
                              </span>
                              {pw.inhibitorsToAvoid.length ? (
                                <span className="text-[0.8rem]">
                                  <strong>{t("attenuate")}</strong> {pw.inhibitorsToAvoid.join("; ")}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="border border-white/10 bg-white/[0.03] px-3 py-3 text-[0.82rem] text-gray-300" colSpan={4}>
                            {t.rich("noPathwayComputed", {
                              date: selectedPlanDateLabel,
                              b: (chunks) => <strong className="text-white">{chunks}</strong>,
                            })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {pathwayModulation?.pathways.length ? (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="nutrition-muted text-[0.78rem]">
                      {t("operationalTiming")}
                    </div>
                    {pathwayModulation.pathways.map((pw) => (
                      <div
                        key={`${pw.id}-timing`}
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[0.82rem]"
                      >
                        <strong className="text-white">{pw.pathwayLabel}</strong>
                        <ul className="mt-2 list-none space-y-2 pl-0">
                          {pw.phases.map((ph) => (
                            <li key={`${pw.id}-${ph.phase}-${ph.windowLabel}`} className={cn(pathwayOperationalPhaseRowClass(ph.phase))}>
                              <strong className="text-white">
                                {ph.phase === "pre_acute"
                                  ? t("phaseAcutePre")
                                  : ph.phase === "peri_workout"
                                    ? t("phasePeriSession")
                                    : ph.phase === "early_recovery"
                                      ? t("phaseEarlyRecovery")
                                      : ph.phase === "late_recovery"
                                        ? t("phaseLateRecovery")
                                        : t("phaseDailySupport")}
                              </strong>
                              {" · "}
                              {ph.windowLabel}{" "}
                              <span className="nutrition-muted text-[0.74rem]">({ph.halfLifeClass})</span>
                              {" — "}
                              {ph.actions.join(" ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </details>
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>{t("functionalFoodsSummary")}</summary>
                <p className="nutrition-muted" style={{ fontSize: "0.8rem", marginTop: "8px", marginBottom: "10px" }}>
                  {t.rich("functionalFoodsIntro", { b: (chunks) => <strong>{chunks}</strong> })}
                </p>
                {functionalFoodRecommendations.targets.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {functionalFoodRecommendations.targets.map((target) => (
                      <div
                        key={target.nutrientId}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[0.84rem]"
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                          <strong>{target.displayNameIt}</strong>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
                            {target.kind === "vitamin"
                              ? t("kindVitamin")
                              : target.kind === "mineral"
                                ? t("kindMineral")
                                : target.kind === "amino_acid"
                                  ? t("kindAminoAcid")
                                  : target.kind === "fatty_acid"
                                    ? t("kindFattyAcid")
                                    : t("kindOther")}
                          </span>
                        </div>
                        <p className="nutrition-muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                          {target.rationaleIt}
                        </p>
                        <div className="nutrition-muted" style={{ fontSize: "0.75rem", marginBottom: "8px" }}>
                          {t("pathwaysLabel", { pathways: target.pathwayLabel })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="nutrition-muted" style={{ fontSize: "0.85rem" }}>
                    {t("noFoodTarget")}
                  </p>
                )}
                <ul className="nutrition-muted" style={{ fontSize: "0.72rem", marginTop: "10px", marginBottom: 0 }}>
                  {functionalFoodRecommendations.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
              {/* Brand e token catalogo: spostati nell'accordion «Dettagli e motore» in fondo pagina. */}
            </section>
          </section>
  );
}
