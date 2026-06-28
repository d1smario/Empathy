"use client";

import { cn } from "@/lib/cn";
import {
  FUNCTIONAL_EXAMPLE_CELL_CLASSES,
  functionalCandidateRowClass,
  metabolicPhaseSlotCardClass,
  nutritionToneForLabel,
  pathwayOperationalPhaseRowClass,
} from "@/lib/nutrition/nutrition-view-helpers";
import {
  buildIntegrationQuantityHint,
  FUELING_CATEGORY_IT,
  FUELING_FORMAT_IT,
  FOCUS_IT,
  TIMING_IT,
  type IntegrationTimingBucket,
} from "@/lib/nutrition/integration-product-ui";
import type { FuelingProduct } from "@/lib/nutrition/fueling-product-catalog";
import type {
  FunctionalFoodRecommendationsViewModel,
  FunctionalMealSelectorViewModel,
  NutritionPathwayModulationViewModel,
  NutrientInterrogationViewModel,
  NutritionPerformanceIntegrationDials,
  UsdaRichFoodItemViewModel,
} from "@/api/nutrition/contracts";
import type { CrossDomainInterpretationRoadmap, EmpathyApplicationPlaybook } from "@empathy/contracts";

/**
 * Sezione "Integrazione" di NutritionPageView (decomposizione del God-component).
 * Render puro: riceve lo stato relativo a USDA rich/lookup + i suoi handler dal
 * padre, e tutte le derive già calcolate (dynamics summary, stack summary,
 * pathway modulation, alimenti funzionali, selettore pasti, prodotti integrazione
 * per timing) come props read-only. Lo stato e il compute restano nel padre —
 * qui solo presentazione.
 *
 * NB: il frammento integration dentro l'accordion «Dettagli e motore» (più in
 * basso in NutritionPageView) NON fa parte di questa estrazione e resta nel padre.
 */
export type IntegrationProductCardProduct = FuelingProduct & { displayImage: string; isLogoFallback: boolean };

function IntegrationProductCard({
  product,
  qtyHint,
  accent,
}: {
  product: IntegrationProductCardProduct;
  qtyHint: string;
  accent: IntegrationTimingBucket;
}) {
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
        : "rgba(251,146,60,0.5)";
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
        <a
          href={product.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="nutrition-product-link"
          style={{ marginTop: 12, fontSize: "0.68rem", fontWeight: 600 }}
        >
          Scheda produttore
        </a>
      </div>
      <a
        href={product.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="nutrition-product-media-link"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 140,
          background: "rgba(0,0,0,0.35)",
          padding: 12,
        }}
        title={product.isLogoFallback ? "Fallback logo marchio" : "Immagine catalogo / archivio"}
      >
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
      </a>
    </article>
  );
}

export type IntegrationSectionProps = {
  integrationDynamicsSummary: { label: string; value: string }[];
  integrationStackSummary: { label: string; value: string }[];
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials | null;
  applicationPlaybook: EmpathyApplicationPlaybook | null;
  showTech: boolean;
  crossDomainInterpretationRoadmap: CrossDomainInterpretationRoadmap | null;
  nutrientInterrogation: NutrientInterrogationViewModel | null;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  selectedPlanDateLabel: string;
  functionalFoodRecommendations: FunctionalFoodRecommendationsViewModel;
  foodLookupLoading: boolean;
  runFoodLookupFromPathway: (query: string) => Promise<void>;
  usdaRichByCatalogId: Record<string, { loading: boolean; error?: string; foods?: UsdaRichFoodItemViewModel[] }>;
  fetchUsdaRichForCatalog: (catalogId: string) => Promise<void>;
  effectiveFunctionalMealSelector: FunctionalMealSelectorViewModel | null;
  integrationProductCards: IntegrationProductCardProduct[];
  integrationProductsByTiming: Record<IntegrationTimingBucket, IntegrationProductCardProduct[]>;
  resolvedFuelingChoGPerHour: number;
};

export function IntegrationSection({
  integrationDynamicsSummary,
  integrationStackSummary,
  nutritionPerformanceIntegration,
  applicationPlaybook,
  showTech,
  crossDomainInterpretationRoadmap,
  nutrientInterrogation,
  pathwayModulation,
  selectedPlanDateLabel,
  functionalFoodRecommendations,
  foodLookupLoading,
  runFoodLookupFromPathway,
  usdaRichByCatalogId,
  fetchUsdaRichForCatalog,
  effectiveFunctionalMealSelector,
  integrationProductCards,
  integrationProductsByTiming,
  resolvedFuelingChoGPerHour,
}: IntegrationSectionProps) {
  return (
          <section id="nutrition-integration" className="scroll-mt-28 mb-10 space-y-4">
            <header className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <h2 className="text-lg font-bold text-white">Integrazione</h2>
              <p className="mt-1 text-sm text-gray-400">Vie metaboliche, KPI, USDA e prodotti — stessi segnali del modulo.</p>
            </header>
            <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
              <h3 className="viz-title">Integrazione</h3>
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>Panoramica integrazione · vie metaboliche</summary>
                <p className="nutrition-muted" style={{ fontSize: "0.82rem", marginTop: "8px", marginBottom: 0 }}>
                  I numeri sotto derivano dalle stesse leve del rifornimento: vie metaboliche attive, segnali del giorno, diary insight e
                  vincoli operativi. Timing espresso come classi qualitative di emivita.
                </p>
              </details>
              <div className="fueling-main-kpi-grid" style={{ marginBottom: "14px" }}>
                {integrationDynamicsSummary.map((card) => (
                  <div key={card.label} className={`fueling-main-kpi-card fueling-main-kpi-card--${nutritionToneForLabel(card.label)}`}>
                    <div className="fueling-main-kpi-label">
                      {card.label}
                    </div>
                    <div className="fueling-main-kpi-value font-mono tabular-nums">{card.value}</div>
                    <div className="fueling-main-kpi-sub">Vie metaboliche</div>
                  </div>
                ))}
              </div>
              <div className="nutrition-section-band" style={{ fontSize: "0.9rem", marginBottom: "8px" }}>
                Catalogo integratori · sintesi numerica
              </div>
              <div className="fueling-main-kpi-grid" style={{ marginBottom: "10px" }}>
                {integrationStackSummary.map((card) => (
                  <div key={card.label} className={`fueling-main-kpi-card fueling-main-kpi-card--${nutritionToneForLabel(card.label)}`}>
                    <div className="fueling-main-kpi-label">
                      {card.label}
                    </div>
                    <div className="fueling-main-kpi-value font-mono tabular-nums">{card.value}</div>
                    <div className="fueling-main-kpi-sub">Catalogo integrazione</div>
                  </div>
                ))}
              </div>
              {nutritionPerformanceIntegration?.rationale.length ? (
                <details
                  className="collapsible-card"
                  style={{ marginBottom: "10px", padding: "10px 12px", borderColor: "rgba(251,191,36,0.35)" }}
                >
                  <summary className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-amber-400">
                    Integrazione performance · leve ({nutritionPerformanceIntegration.rationale.length})
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
                    Diario reale · {nutritionPerformanceIntegration.diaryInsight.loggedDays}/
                    {nutritionPerformanceIntegration.diaryInsight.windowDays} giorni
                    {nutritionPerformanceIntegration.diaryInsight.energyAdequacyRatio != null
                      ? ` · ${Math.round(nutritionPerformanceIntegration.diaryInsight.energyAdequacyRatio * 100)}% target`
                      : ""}
                  </summary>
                  <p className="muted-copy" style={{ fontSize: 12, marginTop: 8, marginBottom: 0, lineHeight: 1.45 }}>
                    Energia media ~{nutritionPerformanceIntegration.diaryInsight.avgDailyKcal ?? "—"} kcal
                    {nutritionPerformanceIntegration.diaryInsight.estimatedMaintenanceKcal != null
                      ? ` vs fabbisogno stimato ~${nutritionPerformanceIntegration.diaryInsight.estimatedMaintenanceKcal} kcal`
                      : ""}
                    . Questo segnale modula le leve training-nutrizione ma non sostituisce i motori fisiologici.
                  </p>
                </details>
              ) : null}
              {applicationPlaybook ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>+ Playbook applicazione · EMPATHY</summary>
                  <p className="nutrition-muted mb-2 mt-2 text-[0.74rem] leading-snug">
                    {applicationPlaybook.playbookHeadlineIt}
                  </p>
                  {applicationPlaybook.directives.length ? (
                    <ul className="mb-3 list-none space-y-2 pl-0 text-[0.78rem]">
                      {applicationPlaybook.directives.slice(0, 3).map((d) => (
                        <li
                          key={d.id}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                        >
                          <strong className="text-white">{d.headlineIt}</strong>
                          <p className="nutrition-muted mt-1 mb-0 text-[0.74rem]">{d.actionIt}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {applicationPlaybook.nutritionAdvice.length ? (
                    <ul className="mb-3 flex flex-wrap gap-2 list-none pl-0 text-[0.72rem]">
                      {applicationPlaybook.nutritionAdvice.slice(0, 4).map((n) => (
                        <li
                          key={n.id}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300"
                          title={n.actionIt}
                        >
                          {n.headlineIt}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {applicationPlaybook.timingProtocols.length ? (
                    <ul className="mb-3 list-none space-y-1 pl-0 text-[0.72rem] text-gray-400">
                      {applicationPlaybook.timingProtocols.slice(0, 4).map((tp) => (
                        <li key={tp.id}>
                          [{tp.pathwayLabel ?? "Protocollo"}] {tp.windowLabelIt}: {tp.actionsIt.join(" · ")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {applicationPlaybook.fuelingAdvice ? (
                    <p className="nutrition-muted mb-0 text-[0.72rem] leading-snug">
                      Rifornimento · {applicationPlaybook.fuelingAdvice.sessionLabel}:{" "}
                      {applicationPlaybook.fuelingAdvice.protocolNotes.join(" · ")}
                    </p>
                  ) : null}
                  <p className="nutrition-muted mt-2 mb-0 text-[0.68rem] opacity-80">{applicationPlaybook.disclaimerIt}</p>
                </details>
              ) : null}
              {showTech && crossDomainInterpretationRoadmap ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>+ Roadmap cross-domain · domini cablati vs backlog</summary>
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
                      {crossDomainInterpretationRoadmap.edges.length} collegamenti attivi tra domini (interpretazione qualitativa).
                    </p>
                  ) : null}
                </details>
              ) : null}
              {showTech && nutrientInterrogation?.items.length ? (
                <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                  <summary>+ Interrogazione nutrienti · ontology multiscala</summary>
                  <p className="nutrition-muted mb-2 mt-2 text-[0.74rem] leading-snug">
                    Collo dominante: {nutrientInterrogation.dominantBottleneckLevelIt} · ontology{" "}
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
                            Geni: {item.geneSymbols.join(", ")}
                          </p>
                        ) : null}
                        {item.activatedNodes.length ? (
                          <p className="nutrition-muted mt-1 mb-0 text-[0.72rem]">
                            Nodi: {item.activatedNodes.map((n) => n.labelIt).slice(0, 3).join(" · ")}
                          </p>
                        ) : null}
                        {item.preferredSlotsIt?.length ? (
                          <p className="nutrition-muted mt-1 mb-0 text-[0.72rem]">
                            Pasti preferiti: {item.preferredSlotsIt.join(", ")}
                          </p>
                        ) : null}
                        <p className="nutrition-muted mt-1 mb-0 text-[0.72rem]">{item.rationaleIt}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <details className="collapsible-card" style={{ marginBottom: "10px" }}>
                <summary>+ Vie metaboliche · substrati, cofattori, inibitori, timing</summary>
                <p className="nutrition-muted mb-2 mt-2 text-[0.74rem] leading-snug">
                  Quattro colonne codificate colore: via/stimolo · fonte segnale · strategia substrati · supporto integrativo e attenuazioni.
                </p>
                <div className="table-shell mt-2 overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full border-collapse text-left text-[0.8rem]">
                    <thead>
                      <tr className="text-[0.65rem] font-bold uppercase tracking-[0.06em]">
                        <th className="border border-white/10 bg-violet-500/25 px-3 py-2.5 text-violet-100">Via / stimolo</th>
                        <th className="border border-white/10 bg-fuchsia-500/22 px-3 py-2.5 text-fuchsia-100">Fonte segnale</th>
                        <th className="border border-white/10 bg-orange-500/20 px-3 py-2.5 text-orange-100">
                          Strategia (substrati)
                        </th>
                        <th className="border border-white/10 bg-sky-500/18 px-3 py-2.5 text-sky-100">
                          Supporto integrativo &amp; attenuazioni
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
                                <strong>Cofattori:</strong> {pw.cofactors.join("; ") || "—"}
                              </span>
                              {pw.inhibitorsToAvoid.length ? (
                                <span className="text-[0.8rem]">
                                  <strong>Attenuare:</strong> {pw.inhibitorsToAvoid.join("; ")}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="border border-white/10 bg-white/[0.03] px-3 py-3 text-[0.82rem] text-gray-300" colSpan={4}>
                            Nessuna via calcolata per <strong className="text-white">{selectedPlanDateLabel}</strong>: aggiungi una seduta pianificata
                            o verifica twin/fisiologia. I modelli (glicogeno, redox, intestino) compaiono quando ci sono
                            stimoli o segnali.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {pathwayModulation?.pathways.length ? (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="nutrition-muted text-[0.78rem]">
                      Timing operativo — colore per fase (pre acuto · peri-seduta · recovery precoce · recovery tardiva)
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
                                  ? "Pre acuto"
                                  : ph.phase === "peri_workout"
                                    ? "Peri-seduta"
                                    : ph.phase === "early_recovery"
                                      ? "Recovery precoce"
                                      : ph.phase === "late_recovery"
                                        ? "Recovery tardiva"
                                        : "Supporto giornaliero"}
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
                <summary>Alimenti funzionali (vitamine, aminoacidi, cofattori) per nutriente</summary>
                <p className="nutrition-muted" style={{ fontSize: "0.8rem", marginTop: "8px", marginBottom: "10px" }}>
                  Per ogni <strong>nutriente</strong> collegato alle vie attive trovi esempi curati e la ricerca prodotti nel tab Pasti, con un
                  elenco di alimenti ordinati per densità del nutriente: scegli e incrocia con il tuo profilo.
                </p>
                {functionalFoodRecommendations.targets.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {functionalFoodRecommendations.targets.map((t) => (
                      <div
                        key={t.nutrientId}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[0.84rem]"
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                          <strong>{t.displayNameIt}</strong>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
                            {t.kind === "vitamin"
                              ? "Vitamina"
                              : t.kind === "mineral"
                                ? "Minerale"
                                : t.kind === "amino_acid"
                                  ? "Aminoacido"
                                  : t.kind === "fatty_acid"
                                    ? "Acido grasso"
                                    : "Altro"}
                          </span>
                        </div>
                        <p className="nutrition-muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                          {t.rationaleIt}
                        </p>
                        <div className="nutrition-muted" style={{ fontSize: "0.75rem", marginBottom: "8px" }}>
                          Vie: {t.pathwayLabel}
                        </div>
                        <div className="mb-2">
                          <strong className="text-[0.8rem] text-white">Esempi alimentari</strong>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            {t.curatedExamples.slice(0, 3).map((ex, idx) => (
                              <div key={`${t.nutrientId}-${ex.name}`} className={FUNCTIONAL_EXAMPLE_CELL_CLASSES[idx % 3]}>
                                <div className="text-[0.78rem] font-semibold leading-snug text-white">{ex.name}</div>
                                <div className="mt-1 text-[0.72rem] leading-snug text-gray-300">{ex.why}</div>
                              </div>
                            ))}
                          </div>
                          {t.curatedExamples.length > 3 ? (
                            <ul className="nutrition-muted mb-0 mt-2 list-disc pl-[1.1rem] text-[0.74rem]">
                              {t.curatedExamples.slice(3).map((ex) => (
                                <li key={`${t.nutrientId}-${ex.name}-more`} className="mb-1">
                                  <strong className="text-gray-200">{ex.name}</strong> — {ex.why}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {t.searchQueries.map((sq) => (
                            <button
                              key={`${t.nutrientId}-${sq}`}
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ cursor: "pointer" }}
                              disabled={foodLookupLoading}
                              onClick={() => void runFoodLookupFromPathway(sq)}
                            >
                              Cerca: {sq}
                            </button>
                          ))}
                        </div>
                        {t.usdaRichSearch ? (
                          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed rgba(148,163,184,0.35)" }}>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ cursor: "pointer", fontWeight: 600 }}
                              disabled={usdaRichByCatalogId[t.nutrientId]?.loading === true}
                              onClick={() => void fetchUsdaRichForCatalog(t.nutrientId)}
                            >
                              {usdaRichByCatalogId[t.nutrientId]?.loading
                                ? "USDA: caricamento…"
                                : `USDA (Foundation/SR): ricchi in ${t.usdaRichSearch.nutrientShortLabel}`}
                            </button>
                            {usdaRichByCatalogId[t.nutrientId]?.error ? (
                              <p className="nutrition-muted" style={{ fontSize: "0.78rem", marginTop: "8px", marginBottom: 0 }}>
                                {usdaRichByCatalogId[t.nutrientId]?.error}
                              </p>
                            ) : null}
                            {usdaRichByCatalogId[t.nutrientId]?.foods?.length ? (
                              <div className="mt-2.5 overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr>
                                      <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Alimento (USDA)</th>
                                      <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Target /100 g</th>
                                      <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">P/C/F</th>
                                      <th className="px-3 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                    {usdaRichByCatalogId[t.nutrientId]!.foods!.map((row) => (
                                      <tr key={row.fdcId} className="transition-colors hover:bg-white/[0.03]">
                                        <td className="px-3 py-2 align-top text-gray-300">
                                          <span className="text-white">{row.description}</span>
                                          <div className="text-[0.68rem] text-gray-500">{row.dataType}</div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-white">
                                          {row.targetAmountPer100g != null
                                            ? `${row.targetAmountPer100g} ${row.targetUnitName ?? ""}`.trim()
                                            : "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[0.7rem] tabular-nums text-white">
                                          {row.proteinG100 != null || row.carbsG100 != null || row.fatG100 != null
                                            ? `${row.proteinG100 ?? "—"}P / ${row.carbsG100 ?? "—"}C / ${row.fatG100 ?? "—"}F`
                                            : "—"}
                                        </td>
                                        <td className="px-3 py-2">
                                          <a
                                            href={`https://fdc.nal.usda.gov/fdc-app.html#/food-details/${row.fdcId}/nutrients`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[0.72rem] text-amber-300 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-200"
                                          >
                                            FDC
                                          </a>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="nutrition-muted" style={{ fontSize: "0.85rem" }}>
                    Nessun target alimentare ancora: servono vie metaboliche attive (seduta + segnali). Le query compariranno qui.
                  </p>
                )}
                {effectiveFunctionalMealSelector ? (
                  <div
                    style={{
                      marginTop: "14px",
                      borderTop: "1px dashed rgba(148,163,184,0.28)",
                      paddingTop: "12px",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                      <strong>Selettore pasti funzionale</strong>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">{effectiveFunctionalMealSelector.status}</span>
                      <span className="nutrition-muted" style={{ fontSize: "0.75rem" }}>
                        {effectiveFunctionalMealSelector.date}
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {effectiveFunctionalMealSelector.slots.map((slot) => (
                        <div
                          key={`${slot.slot}-${slot.focus}`}
                          className={cn(
                            "rounded-xl border-2 p-3",
                            metabolicPhaseSlotCardClass(slot.metabolicPhase),
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="capitalize text-white">{slot.slot.replace("_", " ")}</strong>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">{slot.focus}</span>
                            <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[0.62rem] uppercase tracking-wide text-gray-300">
                              {slot.metabolicPhase.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="nutrition-muted my-2 text-[0.78rem] leading-snug">{slot.rationale}</p>
                          <div className="flex flex-col gap-2">
                            {slot.candidates.map((candidate) => (
                              <div
                                key={`${slot.slot}-${candidate.name}`}
                                className={cn(
                                  "rounded-xl border border-white/10 py-2 pl-3 pr-2 text-[0.76rem] leading-snug text-gray-100",
                                  functionalCandidateRowClass(candidate.timing),
                                )}
                              >
                                <strong className="text-white">{candidate.name}</strong>
                                <span className="text-gray-300"> — {candidate.reason}</span>
                                <div className="nutrition-muted mt-1 text-[0.68rem] leading-snug">
                                  Elementi: {candidate.functionalElements.join(", ")} · timing {candidate.timing}
                                  {candidate.caution ? ` · cautela: ${candidate.caution}` : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <ul className="nutrition-muted" style={{ fontSize: "0.72rem", marginTop: "10px", marginBottom: 0 }}>
                      {effectiveFunctionalMealSelector.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="nutrition-muted" style={{ fontSize: "0.72rem", marginTop: "10px", marginBottom: 0 }}>
                  {functionalFoodRecommendations.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
              {/* Brand e token catalogo: spostati nell'accordion «Dettagli e motore» in fondo pagina. */}
              {integrationProductCards.length ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  {(
                    [
                      {
                        key: "pre" as const,
                        title: "Pre workout",
                        subtitle: "Pre-hydration, caffeina, carichi moderati prima dello stimolo",
                      },
                      {
                        key: "intra" as const,
                        title: "Intra workout",
                        subtitle: "Gel, barrette e drink durante seduta (tolleranza)",
                      },
                      {
                        key: "post" as const,
                        title: "Post workout",
                        subtitle: "Recovery, proteine, creatina — dopo lo stimolo",
                      },
                    ] as const
                  ).map((col) => (
                    <div
                      key={col.key}
                      className={cn(
                        "flex min-h-[120px] flex-col gap-3 rounded-2xl border bg-black/30 p-3",
                        col.key === "pre" && "border-violet-500/40",
                        col.key === "intra" && "border-fuchsia-500/40",
                        col.key === "post" && "border-orange-500/45",
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-xl border border-white/10 bg-gradient-to-r px-3 py-2 to-transparent",
                          col.key === "pre" && "from-violet-600/28",
                          col.key === "intra" && "from-fuchsia-600/28",
                          col.key === "post" && "from-orange-600/28",
                        )}
                      >
                        <div className="text-[0.68rem] font-bold uppercase tracking-wider text-white">{col.title}</div>
                        <div className="nutrition-muted mt-0.5 text-[0.66rem] leading-snug">{col.subtitle}</div>
                      </div>
                      <div className="flex flex-col gap-3">
                        {integrationProductsByTiming[col.key].length ? (
                          integrationProductsByTiming[col.key].map((product) => {
                            const qtyHint = buildIntegrationQuantityHint(product, {
                              choGHour: resolvedFuelingChoGPerHour,
                              energyAdequacyRatio: nutritionPerformanceIntegration?.diaryInsight?.energyAdequacyRatio,
                              proteinBiasPctPoints: nutritionPerformanceIntegration?.proteinBiasPctPoints ?? 0,
                              fuelingChoScale: nutritionPerformanceIntegration?.fuelingChoScale ?? 1,
                            });
                            return (
                              <IntegrationProductCard
                                key={`${col.key}-${product.brand}-${product.product}`}
                                product={product}
                                qtyHint={qtyHint}
                                accent={col.key}
                              />
                            );
                          })
                        ) : (
                          <p className="nutrition-muted m-0 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-2 py-3 text-center text-[0.72rem]">
                            Nessun integratore classificato qui dalla selezione corrente (bucket primario da timing catalogo).
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </section>
  );
}
