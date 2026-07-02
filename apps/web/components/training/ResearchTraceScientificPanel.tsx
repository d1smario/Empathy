"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { KnowledgeExpansionTrace, ResearchHopTrace, ResearchIntent } from "@/lib/empathy/schemas";
import { fetchKnowledgeResearchTracesExpanded } from "@/lib/knowledge/knowledge-research-traces-client";

type ResearchTraceScientificPanelProps = {
  athleteId: string | null | undefined;
  limit?: number;
  /** @deprecated riservato per layout compatto futuro; attualmente ignorato */
  compact?: boolean;
  className?: string;
  /**
   * `multi`: una griglia 4 settori per ogni traccia (utile dove serve confronto).
   * `latest_primary`: una sola griglia canonica sulla traccia più recente; le altre in cronologia collassata (builder training).
   */
  traceSurface?: "multi" | "latest_primary";
};

// Mappa kind → chiavi i18n del settore (i testi visibili vivono nel namespace i18n,
// così restano traducibili anche se HOP_SECTOR è a livello modulo).
const HOP_SECTOR: Record<
  ResearchHopTrace["kind"],
  { shortTitleKey: string; physiologyFunctionKey: string; amplificationFocusKey: string }
> = {
  literature_search: {
    shortTitleKey: "sectorLiteratureShortTitle",
    physiologyFunctionKey: "sectorLiteraturePhysiologyFunction",
    amplificationFocusKey: "sectorLiteratureAmplificationFocus",
  },
  entity_lookup: {
    shortTitleKey: "sectorEntityShortTitle",
    physiologyFunctionKey: "sectorEntityPhysiologyFunction",
    amplificationFocusKey: "sectorEntityAmplificationFocus",
  },
  pathway_lookup: {
    shortTitleKey: "sectorPathwayShortTitle",
    physiologyFunctionKey: "sectorPathwayPhysiologyFunction",
    amplificationFocusKey: "sectorPathwayAmplificationFocus",
  },
  reaction_lookup: {
    shortTitleKey: "sectorReactionShortTitle",
    physiologyFunctionKey: "sectorReactionPhysiologyFunction",
    amplificationFocusKey: "sectorReactionAmplificationFocus",
  },
  projection_review: {
    shortTitleKey: "sectorProjectionShortTitle",
    physiologyFunctionKey: "sectorProjectionPhysiologyFunction",
    amplificationFocusKey: "sectorProjectionAmplificationFocus",
  },
};

const HOP_ORDER = ["hop-literature", "hop-mechanisms", "hop-reactions", "hop-projection"];

function intentForHop(trace: KnowledgeExpansionTrace, hop: ResearchHopTrace): ResearchIntent | null {
  return trace.intents.find((i) => i.intentId === hop.intentId) ?? null;
}

function traceFocus(trace: KnowledgeExpansionTrace, fallback: string) {
  return (
    trace.trigger.stimulusLabel ??
    trace.trigger.entityLabel ??
    trace.trigger.adaptationTarget?.replaceAll("_", " ") ??
    fallback
  );
}

function humanizeEntityTypes(types: string[]): string {
  if (!types.length) return "—";
  return types
    .slice(0, 5)
    .map((t) => t.replaceAll("_", " "))
    .join(" · ");
}

function sortHops(hops: ResearchHopTrace[]): ResearchHopTrace[] {
  return [...hops].sort((a, b) => {
    const ia = HOP_ORDER.indexOf(a.hopId);
    const ib = HOP_ORDER.indexOf(b.hopId);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function traceSubtitle(
  trace: KnowledgeExpansionTrace,
  labels: { module: string; adaptation: string },
) {
  return (
    <>
      {labels.module} {trace.trigger.module ?? "—"} · {trace.trigger.kind}
      {trace.trigger.adaptationTarget
        ? ` · ${labels.adaptation} ${trace.trigger.adaptationTarget.replaceAll("_", " ")}`
        : ""}
    </>
  );
}

// Cache cross-mount delle tracce di ricerca: ri-atterrando sulla pagina (es. builder
// training) i dati compaiono subito (niente spinner "Caricamento tracce…"); il refetch
// avviene in background silenzioso, così i nuovi salvataggi restano comunque riflessi.
// Chiave composta athleteId|limit: dataset diversi non si mischiano mai tra atleti/limiti.
let researchTracesCacheKey: string | null = null;
let researchTracesCache: { traces: KnowledgeExpansionTrace[]; error: string | null } | null = null;

export function ResearchTraceScientificPanel({
  athleteId,
  limit = 8,
  className,
  traceSurface = "multi",
}: ResearchTraceScientificPanelProps) {
  const t = useTranslations("ResearchTraceScientificPanel");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traces, setTraces] = useState<KnowledgeExpansionTrace[]>([]);

  const load = useCallback(async () => {
    const trimmedId = athleteId?.trim();
    if (!trimmedId) {
      setTraces([]);
      return;
    }
    const cacheKey = `${trimmedId}|${limit}`;
    const cached = researchTracesCacheKey === cacheKey ? researchTracesCache : null;
    if (cached) {
      // Stesso atleta+limit già in cache: mostra subito (niente spinner) e prosegui
      // con il refetch in background sotto per riflettere eventuali nuovi salvataggi.
      setTraces(cached.traces);
      setError(cached.error);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetchKnowledgeResearchTracesExpanded(trimmedId, { limit });
      const nextTraces = res.expansionTraces ?? [];
      const nextError = res.error ?? null;
      setError(nextError);
      setTraces(nextTraces);
      researchTracesCache = { traces: nextTraces, error: nextError };
      researchTracesCacheKey = cacheKey;
    } catch (e) {
      if (!cached) {
        setError(e instanceof Error ? e.message : t("loadFailed"));
        setTraces([]);
      }
    } finally {
      setLoading(false);
    }
  }, [athleteId, limit, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!athleteId?.trim()) return null;

  return (
    <div
      className={`rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/20 via-black/40 to-black/60 p-4 sm:p-5 ${className ?? ""}`}
    >
      <h3 className="text-base font-bold text-white">{t("panelTitle")}</h3>
      <p className="mt-1 text-[0.7rem] leading-snug text-gray-500">
        {t("panelSubtitle")}
      </p>

      {loading && <p className="mt-3 text-xs text-gray-500">{t("loadingTraces")}</p>}
      {error && <p className="mt-3 text-xs text-rose-300/90">{error}</p>}
      {!loading && !traces.length && !error && (
        <p className="mt-3 text-xs text-gray-500">{t("emptyTraces")}</p>
      )}

      {(() => {
        const gridTraces = traceSurface === "latest_primary" && traces.length ? [traces[0]] : traces;
        const historyTraces = traceSurface === "latest_primary" && traces.length > 1 ? traces.slice(1) : [];

        return (
          <>
            {gridTraces.map((trace, ti) => {
              const hops = sortHops(trace.hops);
              return (
                <div
                  key={trace.traceId}
                  className={ti > 0 ? "mt-4 border-t border-white/10 pt-4" : "mt-3"}
                >
                  <p className="text-sm font-semibold text-gray-200">
                    {t("focusPrefix")} · {traceFocus(trace, t("focusFallback"))}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-gray-500">
                    {traceSubtitle(trace, { module: t("subtitleModule"), adaptation: t("subtitleAdaptation") })}
                  </p>

                  <div className="builder-kpi-grid mt-3">
                    {hops.map((hop, idx) => {
                      const mappedSector = HOP_SECTOR[hop.kind];
                      const sector = mappedSector
                        ? {
                            shortTitle: t(mappedSector.shortTitleKey),
                            physiologyFunction: t(mappedSector.physiologyFunctionKey),
                            amplificationFocus: t(mappedSector.amplificationFocusKey),
                          }
                        : {
                            shortTitle: hop.kind,
                            physiologyFunction: t("sectorFallbackPhysiologyFunction"),
                            amplificationFocus: hop.kind,
                          };
                      const intent = intentForHop(trace, hop);
                      const docN = hop.linkedDocumentIds?.length ?? 0;
                      const asN = hop.linkedAssertionIds?.length ?? 0;
                      const fnLabel = intent?.label ?? sector.physiologyFunction;
                      return (
                        <div key={hop.traceHopId} className="builder-kpi-card min-h-[7rem] text-left">
                          <div className="kpi-card-label flex items-start gap-2 text-left leading-tight">
                            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" aria-hidden />
                            <span>
                              {idx + 1}. {sector.shortTitle}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold leading-snug text-gray-100">{fnLabel}</p>
                          <p className="mt-2 text-[0.65rem] leading-snug text-gray-400">
                            {t("amplifyLabel")} {sector.amplificationFocus}
                          </p>
                          <p className="mt-2 text-[0.6rem] text-gray-500">
                            {t("entitiesLabel")} {humanizeEntityTypes(hop.expectedEntityTypes)} · {docN} {t("docUnit")} · {asN} {t("assertUnit")} · {hop.status}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {historyTraces.length > 0 ? (
              <details className="mt-4 rounded-xl border border-orange-500/20 bg-orange-950/10 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-orange-200/90">
                  {t("historySummary", { count: historyTraces.length })}
                </summary>
                <ul className="mt-2 space-y-2 border-t border-white/10 pt-2 text-[0.65rem] leading-snug text-gray-400">
                  {historyTraces.map((hist) => (
                    <li key={`hist-${hist.traceId}`} className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
                      <span className="font-mono text-[0.58rem] text-gray-500">{hist.createdAt}</span>
                      <span className="mt-0.5 block font-semibold text-gray-300">{t("focusPrefix")} · {traceFocus(hist, t("focusFallback"))}</span>
                      <span className="mt-0.5 block text-gray-500">{traceSubtitle(hist, { module: t("subtitleModule"), adaptation: t("subtitleAdaptation") })}</span>
                      <span className="mt-0.5 block text-gray-600">
                        {hist.hops.length} {t("hopUnit")} · {hist.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        );
      })()}

      <details className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-gray-200">{t("deepDiveSummary")}</summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-gray-400">
          <p>
            {t.rich("deepDiveIntro", {
              b: (chunks) => <strong className="text-gray-300">{chunks}</strong>,
            })}
          </p>
          {traces.map((trace) => {
            const sectorFn = (key: string | undefined) => (key ? t(key) : undefined);
            return (
              <div key={`txt-${trace.traceId}`}>
                <p className="font-semibold text-gray-300">{traceFocus(trace, t("focusFallback"))}</p>
                {sortHops(trace.hops).map((hop) => {
                  const sector = HOP_SECTOR[hop.kind];
                  const sectorShortTitle = sectorFn(sector?.shortTitleKey);
                  const sectorPhysiology = sectorFn(sector?.physiologyFunctionKey);
                  const intent = intentForHop(trace, hop);
                  return (
                    <div
                      key={hop.traceHopId}
                      className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2.5"
                    >
                      <p className="font-semibold text-gray-300">
                        {sectorShortTitle ?? hop.kind} — {intent?.label ?? sectorPhysiology}
                      </p>
                      <p className="mt-1">
                        {t.rich("deepDiveWhy", { b: (chunks) => <strong>{chunks}</strong> })} {intent?.rationale ?? sectorPhysiology}
                      </p>
                      <p className="mt-1">
                        {t.rich("deepDiveOperationalQuestion", { b: (chunks) => <strong>{chunks}</strong> })} {hop.question}
                      </p>
                      <p className="mt-1 text-[0.65rem] opacity-90">
                        {t("expectedSourcesLabel")} {hop.sourceDbs.join(", ") || "—"} · {t("outcomeLabel")} {hop.resultSummary ?? "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!traces.length && !loading ? <p>{t("noContentTraces")}</p> : null}
        </div>
      </details>
    </div>
  );
}
