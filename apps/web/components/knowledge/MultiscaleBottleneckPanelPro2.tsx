"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";
import { fetchMultiscaleBottleneck } from "@/modules/physiology/services/multiscale-bottleneck-api";
import type { MultiscaleBottleneckApiOk } from "@/lib/knowledge/multiscale-bottleneck-contract";

type Props = {
  athleteId: string | null;
  /** Gergo motore (ontology version, tag interpretativi, nodi/proxy) solo coach/admin. */
  showTech?: boolean;
};

function formatPct01(x: number): string {
  return `${Math.round(x * 100)}%`;
}

// Cache cross-mount della vista multiscala: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/"Aggiornamento…" né placeholder vuoto); il
// refetch avviene comunque in background silenzioso, così le mutazioni (twin/lab)
// restano riflesse al prossimo atterraggio.
let multiscaleBottleneckCacheId: string | null = null;
let multiscaleBottleneckCache: MultiscaleBottleneckApiOk | null = null;

export function MultiscaleBottleneckPanelPro2({ athleteId, showTech = false }: Props) {
  const t = useTranslations("MultiscaleBottleneckPanelPro2");
  const [data, setData] = useState<MultiscaleBottleneckApiOk | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) return;
    // Se i dati di questo atleta sono già in cache, mostrali SUBITO (niente
    // spinner); il refetch in background sotto aggiorna stato + cache.
    const cached = multiscaleBottleneckCacheId === athleteId ? multiscaleBottleneckCache : null;
    if (cached) {
      setData(cached);
      setErr(null);
      setLoading(false);
    } else {
      setLoading(true);
      setErr(null);
    }
    try {
      const res = await fetchMultiscaleBottleneck(athleteId, { includeSubgraph: true });
      setData(res);
      multiscaleBottleneckCache = res;
      multiscaleBottleneckCacheId = athleteId;
    } catch (e) {
      if (!cached) {
        setData(null);
        setErr(e instanceof Error ? e.message : t("loadingError"));
      }
    } finally {
      setLoading(false);
    }
  }, [athleteId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!athleteId) {
    return (
      <p className="text-sm text-slate-500">
        {t("selectAthlete")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? t("updating") : t("updateFromTwinLab")}
        </Pro2Button>
        {/* Versione ontologia = stringa motore: solo staff (audit 2026-07). */}
        {data && showTech ? (
          <span className="font-mono text-[0.65rem] text-slate-500">
            {t("ontology", { version: data.bottleneck.ontologyVersion })}
          </span>
        ) : null}
      </div>

      {err ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{err}</div> : null}

      {!data && !loading && !err ? (
        <p className="text-sm text-slate-500">{t("noDataYet")}</p>
      ) : null}

      {data ? (
        <>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-200/90">{t("dominantBottleneck")}</div>
            <div className="mt-1 text-lg font-bold text-slate-100">{data.dominantLevelLabelIt}</div>
            <div className="mt-2 text-sm text-slate-300">
              {t.rich("interpretiveWeight", {
                value: formatPct01(data.bottleneck.dominantBottleneck.score),
                b: (chunks) => <strong className="text-cyan-100">{chunks}</strong>,
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{data.bottleneck.dominantBottleneck.rationaleIt}</p>
          </div>

          <div>
            <div className="physiology-pro2-mini-banner mb-2">{t("levelOrder")}</div>
            <ul className="space-y-2">
              {data.bottleneck.orderedLevels.map((row) => (
                <li key={row.level} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-8 tabular-nums text-slate-500">L{row.level}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-fuchsia-500/70"
                      style={{ width: formatPct01(row.score) }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums text-slate-400">{formatPct01(row.score)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tag interpretativi (gergo mono) e «Activated Nodes» (ID grafo,
              subgraph, input-proxy motore: redox/glycogen/readiness/gut…):
              solo coach/admin. All'atleta resta dominante + peso + rationale +
              barre L1-Ln (audit 2026-07). */}
          {showTech && data.bottleneck.suggestedInterpretationTags.length > 0 ? (
            <div>
              <div className="physiology-pro2-mini-banner mb-2">{t("interpretiveTags")}</div>
              <div className="flex flex-wrap gap-2">
                {data.bottleneck.suggestedInterpretationTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/15 bg-black/30 px-2.5 py-0.5 font-mono text-[0.65rem] text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {showTech ? (
            <details className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">
              <summary className="cursor-pointer text-slate-300">{t("activatedNodes")}</summary>
              <div className="mt-2 space-y-2 font-mono text-[0.65rem] leading-relaxed">
                <div>
                  <span className="text-slate-500">IDs:</span> {data.bottleneck.activatedNodeIds.join(", ")}
                </div>
                {data.subgraph ? (
                  <div>
                    {t("subgraph", {
                      nodes: data.subgraph.nodes.length,
                      edges: data.subgraph.edges.length,
                    })}
                  </div>
                ) : null}
                <div className="text-slate-500">
                  {t("inputProxies", {
                    redox: data.snapshot.redoxStressIndex ?? "—",
                    inflammation: data.snapshot.twinInflammationRisk ?? "—",
                    glycogen: data.snapshot.glycogenStatus ?? "—",
                    readiness: data.snapshot.readiness ?? "—",
                    gut: data.snapshot.gutStressScorePct ?? "—",
                    choDelivery: data.snapshot.choDeliveryPctOfIngested ?? "—",
                    oxidative: data.snapshot.oxidativeBottleneckIndex ?? "—",
                  })}
                </div>
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
