"use client";

import type {
  HealthStagingRunAction,
  HealthSystemMapViewModel,
} from "@/modules/health/services/health-module-api";
import { HealthStagingReviewLink } from "@/modules/health/views/sections/HealthStagingReviewLink";

export interface HealthSystemMapPanelProps {
  systemMap: HealthSystemMapViewModel;
  systemMapErr: string | null;
  stagingBusy: string | null;
  onPatchStagingRun: (runId: string, status: HealthStagingRunAction) => void;
}

/** Diagnostica coach/admin: mappa interazioni cross-area + interpretation staging. */
export function HealthSystemMapPanel({
  systemMap,
  systemMapErr,
  stagingBusy,
  onPatchStagingRun,
}: HealthSystemMapPanelProps) {
  return (
    <section className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-4 shadow-inner sm:p-6">
      <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
        Interaction map · cross-area overview
      </h2>
      <p className="mt-2 text-sm text-gray-400">
        Nodes, causal links and bioenergetic responses derived from the reports. Includes reviews awaiting
        interpretation.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Nodi", v: systemMap.nodes.length },
          { k: "Archi", v: systemMap.edges.length },
          { k: "Bioenergetica", v: systemMap.bioenergeticsResponses.length },
          { k: "Staging runs", v: systemMap.stagingRuns.length },
        ].map((c) => (
          <div key={c.k} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
            <div className="font-mono text-2xl font-bold tabular-nums text-white">{c.v}</div>
            <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{c.k}</div>
          </div>
        ))}
      </div>
      {systemMapErr ? <p className="mt-3 text-xs text-amber-300">{systemMapErr}</p> : null}
      <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-400">
          Nodes and edges detail
        </summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Active nodes</p>
            <div className="space-y-2">
              {systemMap.nodes.slice(0, 12).map((n, i) => (
                <div key={`node-${i}-${String(n.id ?? n.node_key ?? i)}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs">
                  <div className="font-semibold text-white">{String(n.label ?? n.node_key ?? "node")}</div>
                  <div className="text-gray-400">{String(n.area ?? "area")} · {String(n.observed_at ?? n.created_at ?? "n/d")}</div>
                </div>
              ))}
              {!systemMap.nodes.length ? <p className="text-xs text-gray-500">No nodes available.</p> : null}
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Causal edges</p>
            <div className="space-y-2">
              {systemMap.edges.slice(0, 12).map((e, i) => (
                <div key={`edge-${i}-${String(e.id ?? i)}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs">
                  <div className="font-semibold text-white">
                    {String(e.from_node_key ?? "?")} → {String(e.to_node_key ?? "?")}
                  </div>
                  <div className="text-gray-400">
                    {String(e.effect_sign ?? "modulate")} · conf {typeof e.confidence === "number" ? e.confidence.toFixed(2) : "n/d"} ·{" "}
                    {String(e.rule_key ?? "rule-less")}
                  </div>
                </div>
              ))}
              {!systemMap.edges.length ? <p className="text-xs text-gray-500">No edges available.</p> : null}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Bioenergetic responses</p>
            <div className="space-y-2">
              {systemMap.bioenergeticsResponses.slice(0, 8).map((r, i) => (
                <div key={`bio-${i}-${String(r.id ?? i)}`} className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-2 text-xs">
                  <div className="font-semibold text-amber-100">{String(r.title ?? r.response_key ?? "response")}</div>
                  <div className="text-amber-200/80">{String(r.category ?? "risk")} · {String(r.severity ?? "n/d")}</div>
                </div>
              ))}
              {!systemMap.bioenergeticsResponses.length ? <p className="text-xs text-gray-500">No bioenergetic responses.</p> : null}
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Interpretation staging</p>
            <div className="space-y-2">
              {systemMap.stagingRuns.slice(0, 8).map((s, i) => {
                const runId = typeof s.id === "string" ? s.id : null;
                const triggerSource = typeof s.trigger_source === "string" ? s.trigger_source : "";
                const isVlmReview = triggerSource === "health_upload_vlm" && s.status === "pending_validation";
                return (
                  <div
                    key={`staging-${i}-${String(s.id ?? i)}`}
                    className={`rounded-xl border px-2.5 py-2 text-xs ${
                      isVlmReview ? "border-fuchsia-500/30 bg-fuchsia-500/[0.08]" : "border-rose-500/25 bg-rose-500/[0.06]"
                    }`}
                  >
                    <div className={`font-semibold ${isVlmReview ? "text-fuchsia-100" : "text-rose-100"}`}>
                      {String(s.domain ?? "domain")} · {String(s.status ?? "status")}
                    </div>
                    <div className={isVlmReview ? "text-fuchsia-200/80" : "text-rose-200/80"}>
                      conf {typeof s.confidence === "number" ? s.confidence.toFixed(2) : "n/d"} · {String(s.created_at ?? "n/d")}
                    </div>
                    {runId ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {isVlmReview ? <HealthStagingReviewLink runId={runId} /> : null}
                        {[
                          { status: "committed" as const, label: "Validate" },
                          { status: "rejected" as const, label: "Discard" },
                          { status: "archived" as const, label: "Archive" },
                        ].map((action) => {
                          const busy = stagingBusy === `${runId}:${action.status}`;
                          return (
                            <button
                              key={action.status}
                              type="button"
                              disabled={Boolean(stagingBusy)}
                              onClick={() => onPatchStagingRun(runId, action.status)}
                              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-rose-500/40 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? "..." : action.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!systemMap.stagingRuns.length ? <p className="text-xs text-gray-500">No recent reviews.</p> : null}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
