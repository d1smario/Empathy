"use client";

import { useTranslations } from "next-intl";

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
}

export interface HealthArchiveSectionProps {
  panels: HealthPanelTimelineRow[];
  athleteId: string | null;
  loadingTimeline: boolean;
  timelineErr: string | null;
  timelineDiag: HealthTimelineFetchDiagnostics | null;
  archiveDiagnostics: HealthArchiveDiagnostics;
  pendingVlmRunByPanelId: Map<string, string>;
  expandedPanelId: string | null;
  onToggleExpanded: (panelId: string | null) => void;
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
  expandedPanelId,
  onToggleExpanded,
  onReloadTimeline,
}: HealthArchiveSectionProps) {
  const t = useTranslations("HealthArchiveSection");
  return (
    <section className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-5 shadow-inner" aria-label={t("reportArchive")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">{t("reportArchive")}</h3>
        {athleteId ? (
          <span
            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-gray-400"
            title={t("activeAthleteIdTitle", { athleteId })}
          >
            athlete: {athleteId.slice(0, 8)}…
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-gray-400">
        {t.rich("panelsIntro", { c: (chunks) => <code className="text-gray-300">{chunks}</code> })}
        {!loadingTimeline && !timelineErr ? t("inMemorySuffix", { count: panels.length }) : ""}.
      </p>
      {!loadingTimeline && !timelineErr && archiveDiagnostics.total > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums tracking-wider text-gray-300">
            <span>
              <span className="text-emerald-300">{archiveDiagnostics.withCanonicalValues}</span>
              <span className="text-gray-500">{t("canonicalSuffix")}</span>
            </span>
            <span>
              <span className="text-fuchsia-300">{archiveDiagnostics.withProposalsOnly}</span>
              <span className="text-gray-500">{t("withProposedValuesSuffix")}</span>
            </span>
            <span>
              <span className="text-amber-300">{archiveDiagnostics.importOnly}</span>
              <span className="text-gray-500">{t("filesOnlySuffix")}</span>
            </span>
            {archiveDiagnostics.vlmPending > 0 ? (
              <span>
                <span className="text-violet-300">{archiveDiagnostics.vlmPending}</span>
                <span className="text-gray-500">{t("reviewsToConfirmSuffix")}</span>
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            {t.rich("valuesExplanation", {
              c1: (chunks) => <code className="text-gray-300">{chunks}</code>,
              c: (chunks) => <code>{chunks}</code>,
            })}{" "}
            {archiveDiagnostics.withCanonicalValues + archiveDiagnostics.withProposalsOnly === 0
              ? t("noReadableNumbers")
              : archiveDiagnostics.vlmPending > 0
                ? t("openReviewsUpdateCanonical")
                : t("chartsAligned")}
          </p>
        </div>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loadingTimeline ? (
          <li className="col-span-full py-6 text-center text-sm text-gray-500">{t("loadingArchive")}</li>
        ) : null}
        {!loadingTimeline && timelineErr ? (
          <li className="col-span-full py-4" role="alert">
            <p className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-100">
              {t("failedToReadArchive", { timelineErr })}
            </p>
            {timelineDiag ? (
              <div className="mt-2 space-y-1 text-xs text-gray-500">
                {timelineDiag.requestedAthleteId ? (
                  <p>
                    {t("requestedAthlete")} <code className="text-gray-300">{timelineDiag.requestedAthleteId}</code>
                  </p>
                ) : null}
                {timelineDiag.userProfileAthleteId &&
                timelineDiag.userProfileAthleteId !== timelineDiag.requestedAthleteId ? (
                  <p className="text-amber-300/90">
                    {t.rich("profileAthleteMismatch", {
                      c: (chunks) => <code className="text-amber-100">{chunks}</code>,
                      userProfileAthleteId: timelineDiag.userProfileAthleteId,
                      requestedAthleteId: timelineDiag.requestedAthleteId,
                    })}
                  </p>
                ) : null}
                {timelineDiag.errorCode ? (
                  <p className="text-gray-600">
                    {t("codeLabel")} <code className="text-gray-400">{timelineDiag.errorCode}</code>
                    {typeof timelineDiag.httpStatus === "number" ? ` · HTTP ${timelineDiag.httpStatus}` : ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                {t("problemPersistsHint")}
              </p>
            )}
            <Pro2Button type="button" variant="secondary" className="mt-3 border-white/15 text-xs" onClick={() => onReloadTimeline()}>
              {t("retry")}
            </Pro2Button>
          </li>
        ) : null}
        {!loadingTimeline && !timelineErr && panels.length === 0 ? (
          <li className="col-span-full py-6 text-center text-sm text-gray-500">
            {t.rich("noReportsInArchive", { c: (chunks) => <code className="text-gray-400">{chunks}</code> })}
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
            const isPendingVlm =
              Boolean(vals?.vlm_pending_validation) || importStatus === "vlm_proposed" || reviewRunId != null;
            const valueEntries =
              vals && typeof vals === "object"
                ? Object.entries(vals)
                    .filter(([k]) => k !== "import" && k !== "vlm_proposals")
                    .filter(([, v]) => v !== null && typeof v !== "object")
                    .slice(0, 24)
                : [];
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
                      {t("pending")}
                    </span>
                  ) : null}
                  {nFields > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold tabular-nums text-emerald-300">
                      {t("fieldsBadge", { nFields })}
                    </span>
                  ) : null}
                </div>
                <div
                  className="mt-1 truncate font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500"
                  title={p.source ?? ""}
                >
                  {p.source ? t("sourceWithValue", { source: p.source }) : t("sourceEmpty")}
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
                        {t("structuredValues")}
                        {nFields > 0 ? t("fieldsSuffix", { nFields }) : ""}
                        {nFields === 0 ? t("emptyPayloadSuffix") : ""}
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
                    {expanded ? t("close") : t("open")}
                  </button>
                  {reviewRunId ? <HealthStagingReviewLink runId={reviewRunId} /> : null}
                </div>

                {/* Dettagli espansi */}
                {expanded ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    {valueEntries.length === 0 ? (
                      <p className="text-xs text-gray-500">{t("noStructuredValue")}</p>
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
                        {t("proposedValuesToConfirm", { count: (vals?.vlm_proposals as unknown[]).length })}
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
