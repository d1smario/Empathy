"use client";

import { Layers, Network } from "lucide-react";
import { MultiscaleBottleneckPanelPro2 } from "@/components/knowledge/MultiscaleBottleneckPanelPro2";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Accordion } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import { METABOLIC_CP_ENGINE_REVISION } from "@/lib/engines/critical-power-engine";
import {
  labHistorySectionTitle,
  reliabilityBadge,
  type LabRun,
  type ProCheckRow,
  type PubmedItem,
} from "@/modules/physiology/lib/metabolic-lab-kit";

/**
 * Sezione "Dettagli" del Metabolic Lab (tab dettagli): multiscala, accordion guida,
 * validation console (PubMed + Pro Check) e storico snapshot. Estratta da
 * PhysiologyPageView (fetta 3): display-oriented, riceve dati/handler via props.
 */
type Props = {
  athleteId: string;
  showTech: boolean;
  role: string;
  showValidationConsole: boolean;
  onToggleValidationConsole: () => void;
  lactateReliability: number;
  maxOxReliability: number;
  lactateUncertaintyPct: number;
  maxOxUncertaintyPct: number;
  evidenceLoading: boolean;
  evidenceError: string | null;
  evidenceItems: PubmedItem[];
  onRunEvidenceCheck: () => void;
  proCheckRows: ProCheckRow[];
  alignedRows: ProCheckRow[];
  blockedRows: ProCheckRow[];
  history: LabRun[];
  historyLoading: boolean;
  selectedHistoryId: string | null;
  onSelectHistoryId: (id: string | null) => void;
  selectedHistoryRow: LabRun | null;
  onImportHistoryRow: (row: LabRun) => void;
};

export function MetabolicLabDetailsSection({
  athleteId,
  showTech,
  role,
  showValidationConsole,
  onToggleValidationConsole,
  lactateReliability,
  maxOxReliability,
  lactateUncertaintyPct,
  maxOxUncertaintyPct,
  evidenceLoading,
  evidenceError,
  evidenceItems,
  onRunEvidenceCheck,
  proCheckRows,
  alignedRows,
  blockedRows,
  history,
  historyLoading,
  selectedHistoryId,
  onSelectHistoryId,
  selectedHistoryRow,
  onImportHistoryRow,
}: Props) {
  return (
    <div className="space-y-8">
      <Pro2SectionCard
        accent="emerald"
        icon={Network}
        title="Biological multiscale · bottleneck (interpretation)"
        subtitle="Narrative and interpretive tags only: it does not modify your profile data"
      >
        <p className="mb-3 text-xs leading-relaxed text-gray-500">
          L1–L6 priorities and ontology nodes activated <strong>deterministically</strong>. The canonical numbers remain in the
          physiology / bioenergetics engines.
        </p>
        <MultiscaleBottleneckPanelPro2 athleteId={athleteId} />
      </Pro2SectionCard>

      <Pro2Accordion
        id="mod-dettagli-motore"
        title="How it works"
        subtitle="How to read the three analyses and what we save for you"
        accent="slate"
      >
        <div className="space-y-3 text-sm leading-relaxed text-gray-400">
          <p>
            <strong className="text-gray-200">Metabolic profile</strong> — From your power curve we derive thresholds (CP, FTP, LT),
            estimated VO₂max and the training zones with the predicted carbohydrate and fat consumption. When you save, the value stays
            on your profile and the next time you open it you find your latest analysis again.
          </p>
          <p>
            <strong className="text-gray-200">Lactate analysis</strong> — Estimates how much fuel (carbohydrates) you use at a given intensity,
            how much you absorb and how much you reconvert. It helps you understand how to fuel during long efforts.
          </p>
          <p>
            <strong className="text-gray-200">Oxidative capacity</strong> — Measures how deeply you can use oxygen and where the
            limit lies (heart/blood, muscle, or aerobic ceiling). Useful for prolonged aerobic efforts.
          </p>
          <p className="text-xs text-gray-500">
            The numbers update on their own when you change the inputs; the history keeps every analysis you save, so you can compare your progress.
          </p>
        </div>
      </Pro2Accordion>

      {showTech ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <small className="text-xs text-gray-400">Internal validation console (visible only to coach/staff).</small>
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
              onClick={onToggleValidationConsole}
            >
              {showValidationConsole ? "Hide validation" : "Show validation"}
            </Pro2Button>
          </div>
        </div>
      ) : null}
      {showTech && showValidationConsole ? (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">
              Lactate reliability:{" "}
              <strong className="font-mono tabular-nums" style={{ color: reliabilityBadge(lactateReliability).color }}>{lactateReliability}%</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">
              MaxOx reliability:{" "}
              <strong className="font-mono tabular-nums" style={{ color: reliabilityBadge(maxOxReliability).color }}>{maxOxReliability}%</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
              Lactate uncertainty: <strong className="font-mono tabular-nums">±{lactateUncertaintyPct}%</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
              MaxOx uncertainty: <strong className="font-mono tabular-nums">±{maxOxUncertaintyPct}%</strong>
            </span>
          </div>
          <Pro2Button type="button" variant="primary" onClick={onRunEvidenceCheck} disabled={evidenceLoading}>
            {evidenceLoading ? "Checking evidence..." : "Validate with PubMed"}
          </Pro2Button>
        </div>
        {evidenceError && <div className="alert-error" style={{ marginTop: "10px", marginBottom: 0 }}>{evidenceError}</div>}
        {evidenceItems.length > 0 && (
          <div className="mt-2.5 grid gap-2">
            {evidenceItems.slice(0, 5).map((item) => (
              <a
                key={item.pmid}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-gray-200 no-underline transition-colors hover:border-emerald-500/40 hover:bg-white/[0.05]"
              >
                <strong className="mb-0.5 block text-white">{item.title}</strong>
                <small className="text-gray-500">
                  {item.journal ?? "Journal n/a"} · {item.pub_date ?? "date n/a"} · PMID {item.pmid}
                </small>
              </a>
            ))}
          </div>
        )}
        {(
          <div className="mt-3">
            <h4 className="mb-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Pro Check · source + literature alignment
            </h4>
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
                <strong className="text-emerald-300">Aligned (published): {alignedRows.length}</strong>
                <div className="mt-1.5 grid gap-1 text-xs text-gray-300">
                  {alignedRows.length === 0 ? <span>No aligned value.</span> : alignedRows.map((row) => <span key={`ok-${row.key}`}>{row.label}: {row.valueText}</span>)}
                </div>
              </div>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
                <strong className="text-rose-300">Blocked (not published): {blockedRows.length}</strong>
                <div className="mt-1.5 grid gap-1 text-xs text-gray-300">
                  {blockedRows.length === 0 ? <span>All values are aligned.</span> : blockedRows.map((row) => <span key={`ko-${row.key}`}>{row.label}</span>)}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Value</th>
                    <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Source</th>
                    <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Study range</th>
                    <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Evidence</th>
                    <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {proCheckRows.map((row) => (
                    <tr key={row.key} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">
                        <strong className="text-white">{row.label}</strong>
                        <div className="mt-0.5 font-mono text-[0.7rem] tabular-nums text-gray-400">{row.valueText}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-300">{row.source}</td>
                      <td className="px-3 py-2 text-gray-300">
                        {row.rangeText} {row.inRange ? "✓" : "✕"}
                      </td>
                      <td className="px-3 py-2 text-gray-300">{row.evidenceReady ? "synced" : "missing"}</td>
                      <td className={cn("px-3 py-2 font-bold", row.aligned ? "text-emerald-300" : "text-rose-300")}>
                        {row.aligned ? "ALIGNED" : "BLOCKED"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Rule: a value is publishable only if source-check valid + physiological range in literature + evidence available.
            </p>
          </div>
        )}
      </div>
      ) : null}

      {showTech ? (
      <Pro2SectionCard
        accent="slate"
        icon={Layers}
        title="Metabolic Lab history"
        subtitle="Snapshot list + import into inputs — technical detail below"
      >
        <p className="mb-3 text-xs leading-relaxed text-gray-500">
          The KPIs on the page use the <strong>current engine</strong> (
          <code className="rounded bg-black/30 px-1 font-mono text-[0.65rem]">{METABOLIC_CP_ENGINE_REVISION}</code>
          ). Below is the <strong>frozen snapshot</strong> at save time.
        </p>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">No saved snapshot.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[min(100%,280px)] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Snapshot archive
                <select
                  className="w-full max-w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  value={selectedHistoryId ?? ""}
                  onChange={(e) => onSelectHistoryId(e.target.value ? e.target.value : null)}
                >
                  <option value="">Select a snapshot…</option>
                  {history.map((row) => (
                    <option key={row.id} value={row.id}>
                      {new Date(row.created_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                      {labHistorySectionTitle(row.section)} · {row.model_version}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 pb-0.5">
                <Pro2Button
                  type="button"
                  variant="primary"
                  className="text-xs"
                  disabled={!selectedHistoryRow}
                  onClick={() => {
                    if (selectedHistoryRow) onImportHistoryRow(selectedHistoryRow);
                  }}
                >
                  Import into inputs
                </Pro2Button>
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  disabled={!selectedHistoryRow}
                  onClick={() => onSelectHistoryId(null)}
                >
                  Deselect
                </Pro2Button>
              </div>
            </div>
            {selectedHistoryRow ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-gray-400">
                    <span className="font-semibold text-gray-200">
                      {labHistorySectionTitle(selectedHistoryRow.section)}
                    </span>
                    {" · "}
                    {new Date(selectedHistoryRow.created_at).toLocaleString("en-US")}
                    {" · "}
                    <span className="font-mono">{selectedHistoryRow.model_version}</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">input_payload</p>
                    <pre className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[0.7rem] leading-relaxed text-gray-300">
                      {JSON.stringify(selectedHistoryRow.input_payload ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">output_payload</p>
                    <pre className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[0.7rem] leading-relaxed text-gray-300">
                      {JSON.stringify(selectedHistoryRow.output_payload ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Pro2SectionCard>
      ) : null}

      {showTech ? (
        <p className="text-xs text-gray-600">
          Context: {role === "coach" ? "Coach" : "Private"} · Athlete {athleteId.slice(0, 8)}…
        </p>
      ) : null}
    </div>
  );
}
