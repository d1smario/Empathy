"use client";

import { Pro2Button } from "@/components/ui/empathy";
import type {
  HealthPanelTimelineRow,
  HealthTimelineFetchDiagnostics,
} from "@/modules/health/services/health-module-api";
import { structuredValuesFieldCount } from "@/modules/health/lib/health-panel-readers";
import { HealthStagingReviewLink } from "@/modules/health/views/sections/HealthStagingReviewLink";

export interface HealthArchiveDiagnostics {
  total: number;
  withCanonicalValues: number;
  withProposalsOnly: number;
  importOnly: number;
  vlmPending: number;
  bulkCandidates: number;
  importOnlyNoStorage: number;
  importOnlyUnsupported: number;
}

export interface HealthArchiveSectionProps {
  panels: HealthPanelTimelineRow[];
  athleteId: string | null;
  loadingTimeline: boolean;
  timelineErr: string | null;
  timelineDiag: HealthTimelineFetchDiagnostics | null;
  archiveDiagnostics: HealthArchiveDiagnostics;
  pendingVlmRunByPanelId: Map<string, string>;
  bulkBusy: boolean;
  analyzeBusyPanelId: string | null;
  expandedPanelId: string | null;
  onToggleExpanded: (panelId: string | null) => void;
  onBulkReanalyze: () => void;
  onAnalyzePanelWithAi: (panelId: string) => void;
  onReloadTimeline: () => void;
}

/** Diagnostica coach/admin: archivio referti da `biomarker_panels`. */
export function HealthArchiveSection({
  panels,
  athleteId,
  loadingTimeline,
  timelineErr,
  timelineDiag,
  archiveDiagnostics,
  pendingVlmRunByPanelId,
  bulkBusy,
  analyzeBusyPanelId,
  expandedPanelId,
  onToggleExpanded,
  onBulkReanalyze,
  onAnalyzePanelWithAi,
  onReloadTimeline,
}: HealthArchiveSectionProps) {
  return (
    <section className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-5 shadow-inner" aria-label="Report archive">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">Report archive</h3>
        {athleteId ? (
          <span
            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-gray-400"
            title={`active athleteId: ${athleteId}`}
          >
            athlete: {athleteId.slice(0, 8)}…
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-gray-400">
        Panels from <code className="text-gray-300">biomarker_panels</code> for the active athlete
        {!loadingTimeline && !timelineErr ? ` · ${panels.length} in memory` : ""}.
      </p>
      {!loadingTimeline && !timelineErr && archiveDiagnostics.total > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums tracking-wider text-gray-300">
            <span>
              <span className="text-emerald-300">{archiveDiagnostics.withCanonicalValues}</span>
              <span className="text-gray-500"> canonical</span>
            </span>
            <span>
              <span className="text-fuchsia-300">{archiveDiagnostics.withProposalsOnly}</span>
              <span className="text-gray-500"> with proposed values</span>
            </span>
            <span>
              <span className="text-amber-300">{archiveDiagnostics.importOnly}</span>
              <span className="text-gray-500"> files only (empty)</span>
            </span>
            {archiveDiagnostics.vlmPending > 0 ? (
              <span>
                <span className="text-violet-300">{archiveDiagnostics.vlmPending}</span>
                <span className="text-gray-500"> reviews to confirm</span>
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            The cards and charts read the numbers from <code className="text-gray-300">values</code> of the most recent panel
            per type (e.g. <code>crp_mg_l</code>, <code>cortisol_am</code>, <code>firmicutes_pct</code>,{" "}
            <code>methylation_score</code>) and fall back to the <code>vlm_proposals</code> not yet confirmed.{" "}
            {archiveDiagnostics.withCanonicalValues + archiveDiagnostics.withProposalsOnly === 0
              ? "No report has readable numbers: upload an exam or apply a canonical seed."
              : archiveDiagnostics.vlmPending > 0
                ? "Open reviews update the canonical state in the DB; until you confirm them, the numbers stay in «proposed» mode."
                : "The charts are aligned with the athlete's memory."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={bulkBusy || archiveDiagnostics.bulkCandidates === 0}
              onClick={() => onBulkReanalyze()}
              className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-100 transition-colors hover:border-rose-400/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                archiveDiagnostics.bulkCandidates > 0
                  ? "Start bulk re-analyze on the files in storage"
                  : "No reusable file (no report with a file in Storage and image/pdf format)"
              }
            >
              {bulkBusy
                ? "Processing…"
                : archiveDiagnostics.bulkCandidates > 0
                  ? `Turn ${archiveDiagnostics.bulkCandidates} files into proposed values`
                  : "Turn files into proposed values (0 candidates)"}
            </button>
            <span className="text-[10px] text-gray-500">
              {archiveDiagnostics.bulkCandidates > 0
                ? "Routes the reports without values onto the canonical pipeline; the numbers land in the charts as «proposed» and stay pending confirmation in review."
                : archiveDiagnostics.importOnlyNoStorage > 0
                  ? `${archiveDiagnostics.importOnlyNoStorage} reports have no file in Storage (uploaded before the bucket was configured, or upload failed). To analyze them, re-upload the file from the «Upload exam» module above.`
                  : archiveDiagnostics.importOnlyUnsupported > 0
                    ? `${archiveDiagnostics.importOnlyUnsupported} reports have an unsupported format (only image/* or application/pdf can be processed).`
                    : archiveDiagnostics.importOnly === 0
                      ? "All reports already have canonical or proposed values: nothing to reprocess."
                      : "No candidate for the bulk (check that the reports have an image/pdf file in Storage)."}
            </span>
          </div>
        </div>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loadingTimeline ? (
          <li className="col-span-full py-6 text-center text-sm text-gray-500">Loading archive…</li>
        ) : null}
        {!loadingTimeline && timelineErr ? (
          <li className="col-span-full py-4" role="alert">
            <p className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-100">
              Failed to read archive: {timelineErr}
            </p>
            {timelineDiag ? (
              <div className="mt-2 space-y-1 text-xs text-gray-500">
                {timelineDiag.requestedAthleteId ? (
                  <p>
                    Requested athlete: <code className="text-gray-300">{timelineDiag.requestedAthleteId}</code>
                  </p>
                ) : null}
                {timelineDiag.userProfileAthleteId &&
                timelineDiag.userProfileAthleteId !== timelineDiag.requestedAthleteId ? (
                  <p className="text-amber-300/90">
                    Athlete linked to your profile:{" "}
                    <code className="text-amber-100">{timelineDiag.userProfileAthleteId}</code> — the athlete active
                    in the UI does not match. Open Athletes / Access and select the one with the reports, or re-run the
                    SQL seed on <code className="text-amber-100">{timelineDiag.requestedAthleteId}</code>.
                  </p>
                ) : null}
                {timelineDiag.errorCode ? (
                  <p className="text-gray-600">
                    Code: <code className="text-gray-400">{timelineDiag.errorCode}</code>
                    {typeof timelineDiag.httpStatus === "number" ? ` · HTTP ${timelineDiag.httpStatus}` : ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                If the problem persists, sign out and back in or verify that the selected athlete is the one with the
                reports in the database.
              </p>
            )}
            <Pro2Button type="button" variant="secondary" className="mt-3 border-white/15 text-xs" onClick={() => onReloadTimeline()}>
              Retry
            </Pro2Button>
          </li>
        ) : null}
        {!loadingTimeline && !timelineErr && panels.length === 0 ? (
          <li className="col-span-full py-6 text-center text-sm text-gray-500">
            No report in the archive for this athlete. Use «Upload exam» above, or apply the SQL seed on the
            same active <code className="text-gray-400">athlete_id</code>
            {athleteId ? (
              <>
                {" "}(<code className="text-gray-400">{athleteId}</code>)
              </>
            ) : null}
            .
          </li>
        ) : null}
        {!loadingTimeline &&
          panels.map((p) => {
            const vals = (p.values ?? null) as Record<string, unknown> | null;
            const imp = vals?.import as
              | { filename?: string; status?: string; storage_path?: string; mime?: string }
              | undefined;
            const nFields = structuredValuesFieldCount(vals);
            const expanded = expandedPanelId === p.id;
            const reviewRunId = pendingVlmRunByPanelId.get(p.id) ?? null;
            const importStatus = imp?.status ?? "";
            const mimeLower = (imp?.mime ?? "").toLowerCase();
            const hasImage = mimeLower.startsWith("image/");
            const hasPdf = mimeLower === "application/pdf" || (imp?.filename ?? "").toLowerCase().endsWith(".pdf");
            const hasStorage = Boolean(imp?.storage_path);
            const canAnalyzeWithAi =
              hasStorage &&
              (hasImage || hasPdf) &&
              ["needs_manual_review", "failed", undefined, ""].includes(importStatus) &&
              reviewRunId == null;
            const isPendingVlm =
              Boolean(vals?.vlm_pending_validation) || importStatus === "vlm_proposed" || reviewRunId != null;
            const valueEntries =
              vals && typeof vals === "object"
                ? Object.entries(vals)
                    .filter(([k]) => k !== "import" && k !== "vlm_proposals")
                    .filter(([, v]) => v !== null && typeof v !== "object")
                    .slice(0, 24)
                : [];
            const analyzing = analyzeBusyPanelId === p.id;
            return (
              <li
                key={p.id}
                className={`flex flex-col rounded-xl border bg-white/[0.03] p-4 text-sm ${
                  isPendingVlm ? "border-fuchsia-500/40" : "border-white/10"
                } ${expanded ? "sm:col-span-2 lg:col-span-3" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold capitalize text-white">{p.type.replace(/_/g, " ")}</span>
                  {isPendingVlm ? (
                    <span className="inline-flex items-center rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-fuchsia-300">
                      Pending
                    </span>
                  ) : null}
                  {nFields > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold tabular-nums text-emerald-300">
                      {nFields} fields
                    </span>
                  ) : null}
                </div>
                <div
                  className="mt-1 truncate font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500"
                  title={p.source ?? ""}
                >
                  {p.source ? `Source: ${p.source}` : "Source: —"}
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span className="whitespace-nowrap font-mono tabular-nums text-gray-400">
                    {p.sample_date ?? p.reported_at?.slice(0, 10) ?? p.created_at?.slice(0, 10) ?? "—"}
                  </span>
                  <span className="min-w-0 break-words">
                    {imp?.filename ? (
                      <>
                        <span className="text-gray-200">{imp.filename}</span>
                        <span className="text-gray-500"> · {imp.status ?? "—"}</span>
                      </>
                    ) : (
                      <span>
                        Structured values{nFields > 0 ? ` · ${nFields} fields` : ""}
                        {nFields === 0 ? " (empty payload or import only)" : ""}
                      </span>
                    )}
                  </span>
                </div>
                {imp?.filename && imp.storage_path ? (
                  <div className="mt-0.5 truncate text-[10px] text-gray-600" title={imp.storage_path}>
                    {imp.storage_path}
                  </div>
                ) : null}

                {/* Azioni */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleExpanded(expanded ? null : p.id)}
                    className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-rose-500/40 hover:text-white"
                  >
                    {expanded ? "Close" : "Open"}
                  </button>
                  {reviewRunId ? <HealthStagingReviewLink runId={reviewRunId} /> : null}
                  {canAnalyzeWithAi ? (
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => onAnalyzePanelWithAi(p.id)}
                      className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-rose-100 transition-colors hover:border-rose-400/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {analyzing ? "Extracting…" : "Extract from report"}
                    </button>
                  ) : null}
                </div>

                {/* Dettagli espansi */}
                {expanded ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    {valueEntries.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        No structured value in this panel. If you have a file in storage, try «Extract from report».
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
                        {valueEntries.map(([k, v]) => (
                          <div key={k} className="min-w-0">
                            <div className="truncate font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500" title={k}>
                              {k}
                            </div>
                            <div className="truncate font-mono tabular-nums text-gray-200" title={String(v)}>
                              {typeof v === "number" ? v.toLocaleString() : String(v)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(vals?.vlm_proposals) && (vals?.vlm_proposals as unknown[]).length > 0 ? (
                      <p className="mt-3 text-[11px] text-fuchsia-300">
                        {(vals?.vlm_proposals as unknown[]).length} proposed values to confirm. Open the review to accept them.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
