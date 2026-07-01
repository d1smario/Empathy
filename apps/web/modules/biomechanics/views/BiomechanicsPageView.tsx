"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, Camera, CheckCircle2, Clock3, UploadCloud } from "lucide-react";
import type {
  BiomechanicsCameraPlane,
  BiomechanicsCaptureJobV1,
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsSessionImportV1,
} from "@empathy/contracts";
import { Pro2StickyAnchorSubnav } from "@/components/navigation/Pro2StickyAnchorSubnav";
import { MODULE_PILL_TEAL } from "@/components/navigation/module-pill-styles";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import {
  Pro2Accordion,
  Pro2Button,
  Pro2Link,
  pro2ButtonClassName,
  type Pro2ButtonVariant,
} from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import { scopedShellHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  fetchBiomechanicsSessions,
  importBiomechanicsOpenCapSession,
  processBiomechanicsCaptureJob,
  uploadBiomechanicsCapture,
} from "@/modules/biomechanics/services/biomechanics-module-api";

const DISCIPLINE_OPTIONS: Array<{ value: BiomechanicsDiscipline; label: string }> = [
  { value: "cycling", label: "Cycling" },
  { value: "running", label: "Running" },
  { value: "walking", label: "Walking" },
  { value: "gym", label: "Gym" },
  { value: "movement_screening", label: "Movement screening" },
];

const CAMERA_OPTIONS: Array<{ value: BiomechanicsCameraPlane; label: string }> = [
  { value: "side", label: "Side" },
  { value: "front", label: "Front" },
  { value: "rear", label: "Rear" },
  { value: "oblique", label: "Oblique" },
  { value: "multi_view", label: "Multi-view" },
];

const SOURCE_LABELS: Record<BiomechanicsCaptureSource, string> = {
  smartphone_video: "Smartphone video",
  gopro_video: "Action cam video",
  image: "Image",
  manual_import: "Manual import",
  external_pose_import: "External import (OpenCap)",
};

// Cache cross-mount delle catture biomeccaniche: ri-atterrando sulla pagina i
// dati compaiono subito (niente spinner "Caricamento archivio…"); il refresh
// avviene in background silenzioso, così upload/import/analisi restano riflessi.
type BiomechanicsRefreshData = {
  sessions: BiomechanicsSessionImportV1[];
  captureJobs: BiomechanicsCaptureJobV1[];
  pendingStaging: Array<{ id: string; jobId: string | null }>;
  error: string | null;
};
let biomechanicsCacheId: string | null = null;
let biomechanicsCache: BiomechanicsRefreshData | null = null;

function disciplineLabel(value: BiomechanicsDiscipline): string {
  return DISCIPLINE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function cameraLabel(value: BiomechanicsCameraPlane): string {
  return CAMERA_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function sourceLabel(value: BiomechanicsSessionImportV1["source"]): string {
  return SOURCE_LABELS[value as BiomechanicsCaptureSource] ?? value;
}

function statusLabel(job: BiomechanicsCaptureJobV1, awaitingReview: boolean): string {
  if (awaitingReview) return "To validate";
  switch (job.status) {
    case "pending":
      return "Queued";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const ADMIN_SCOPE_LINK_TITLE = "Available in the dedicated tab (v2)";

/** Link verso rotte modulo: riscritto nello scope coach/admin, inerte solo se non scopabile. */
function ShellLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const { athleteId, adminScoped, platformAdminView, scopeOwnerUserId } = useActiveAthlete();
  const resolved = scopedShellHref(href, { athleteId, adminScoped, platformAdminView, scopeOwnerUserId });
  if (resolved === null) {
    return (
      <span className={cn(className, "cursor-default opacity-50")} title={ADMIN_SCOPE_LINK_TITLE}>
        {children}
      </span>
    );
  }
  return (
    <Link href={resolved} className={className}>
      {children}
    </Link>
  );
}

/** Variante Pro2Link dello stesso gate cross-shell. */
function ShellPro2Link({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Pro2ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  const { athleteId, adminScoped, platformAdminView, scopeOwnerUserId } = useActiveAthlete();
  const resolved = scopedShellHref(href, { athleteId, adminScoped, platformAdminView, scopeOwnerUserId });
  if (resolved === null) {
    return (
      <span className={cn(pro2ButtonClassName(variant, className), "cursor-default opacity-50")} title={ADMIN_SCOPE_LINK_TITLE}>
        {children}
      </span>
    );
  }
  return (
    <Pro2Link href={resolved} variant={variant} className={className}>
      {children}
    </Pro2Link>
  );
}

function LatestJobCard({
  job,
  awaitingReview,
}: {
  job: BiomechanicsCaptureJobV1 | null;
  awaitingReview: boolean;
}) {
  if (!job) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Latest capture</p>
        <p className="mt-2 text-sm text-gray-300">No capture uploaded yet.</p>
      </div>
    );
  }
  const Icon = job.status === "failed" ? AlertTriangle : awaitingReview || job.status === "completed" ? CheckCircle2 : Clock3;
  return (
    <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-teal-300" />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Latest capture</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{statusLabel(job, awaitingReview)}</p>
      <p className="mt-1 text-xs text-gray-400">
        {disciplineLabel(job.discipline)} · {cameraLabel(job.cameraPlane)} · {formatDateTime(job.createdAt)}
      </p>
      {job.errorMessage ? <p className="mt-2 text-xs text-rose-200">{job.errorMessage}</p> : null}
    </div>
  );
}

function CaptureNextSteps({
  latestJob,
  awaitingReview,
  stagingRunId,
  processingJobId,
  showTech,
  onAnalyze,
}: {
  latestJob: BiomechanicsCaptureJobV1 | null;
  awaitingReview: boolean;
  stagingRunId: string | null;
  processingJobId: string | null;
  showTech: boolean;
  onAnalyze: () => void;
}) {
  if (awaitingReview && stagingRunId) {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-amber-300">Next step</p>
        {showTech ? (
          <>
            <p className="mt-2 text-sm text-amber-100">
              Proposal ready — it&apos;s not a report yet. Validate it to generate efficiency, symmetry and risk.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ShellPro2Link href={`/biomechanics/staging/${stagingRunId}`} className="justify-center">
                Validate proposal
              </ShellPro2Link>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-100">
            Your capture is recorded and awaiting validation from the coach. You&apos;ll receive the report when it&apos;s ready.
          </p>
        )}
      </div>
    );
  }

  if (latestJob?.status === "pending") {
    return (
      <div className="mt-4 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-teal-300">Next step</p>
        <p className="mt-2 text-sm text-teal-100">
          Video queued. Start the analysis to get proposed angles and risks.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Pro2Button onClick={onAnalyze} disabled={processingJobId != null} className="justify-center">
            {processingJobId === latestJob.id ? "Analysis in progress..." : "Analyze video"}
          </Pro2Button>
        </div>
      </div>
    );
  }

  if (latestJob?.status === "processing" && !awaitingReview) {
    return (
      <div className="mt-4 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4">
        <p className="text-sm text-teal-100">Analysis interrupted or pending. Retry the analysis.</p>
        <div className="mt-3">
          <Pro2Button onClick={onAnalyze} disabled={processingJobId != null} className="justify-center">
            {processingJobId ? "Analysis in progress..." : "Retry analysis"}
          </Pro2Button>
        </div>
      </div>
    );
  }

  if (latestJob?.status === "failed") {
    return (
      <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
        <p className="text-sm text-rose-100">
          Last analysis failed{latestJob.errorMessage ? `: ${latestJob.errorMessage}` : "."} Upload the video again.
        </p>
      </div>
    );
  }

  return null;
}

function SessionList({
  sessions,
}: {
  sessions: BiomechanicsSessionImportV1[];
}) {
  if (!sessions.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
        <Activity className="h-8 w-8 text-teal-400" />
        <p className="text-sm font-semibold text-white">No confirmed report</p>
        <p className="max-w-sm text-sm text-gray-400">
          The analysis produces a <strong className="text-white">proposal to validate</strong> — the report
          (efficiency, symmetry, risk) appears here only after confirmation.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.slice(0, 5).map((session) => (
        <ShellLink
          key={session.id}
          href={`/biomechanics/sessions/${session.id}`}
          className="group block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-teal-500/40 hover:bg-white/[0.05]"
        >
          <p className="text-sm font-semibold text-white">{disciplineLabel(session.discipline)}</p>
          <p className="mt-1 text-xs text-gray-400">
            {formatDateTime(session.recordedAt)} · {sourceLabel(session.source)}
          </p>
          {session.efficiencyScores ? (
            <p className="mt-2 text-[0.72rem] text-gray-400">
              Efficiency {Math.round(session.efficiencyScores.biomechanicalEfficiency01 * 100)}% · symmetry{" "}
              {Math.round(session.efficiencyScores.symmetry01 * 100)}% · risk{" "}
              {Math.round(session.efficiencyScores.injuryRisk01 * 100)}%
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-teal-300">
            Open full report{" "}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </p>
        </ShellLink>
      ))}
    </div>
  );
}

export default function BiomechanicsPageView() {
  const { athleteId, loading: athleteLoading, role, adminScoped } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  const [discipline, setDiscipline] = useState<BiomechanicsDiscipline>("cycling");
  const [cameraPlane, setCameraPlane] = useState<BiomechanicsCameraPlane>("side");
  const [file, setFile] = useState<File | null>(null);
  const [sessions, setSessions] = useState<BiomechanicsSessionImportV1[]>([]);
  const [captureJobs, setCaptureJobs] = useState<BiomechanicsCaptureJobV1[]>([]);
  const [pendingStaging, setPendingStaging] = useState<Array<{ id: string; jobId: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [openCapSessionId, setOpenCapSessionId] = useState("");
  const [importingOpenCap, setImportingOpenCap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewStagingRunId, setReviewStagingRunId] = useState<string | null>(null);
  const [lastCreatedJob, setLastCreatedJob] = useState<BiomechanicsCaptureJobV1 | null>(null);

  const serverLatestJob = captureJobs[0] ?? null;
  const latestJob =
    serverLatestJob && lastCreatedJob?.id === serverLatestJob.id ? serverLatestJob : serverLatestJob ?? lastCreatedJob;
  const activeStagingId = reviewStagingRunId ?? pendingStaging[0]?.id ?? null;
  const latestJobAwaitingReview = pendingStaging.length > 0;
  const source: BiomechanicsCaptureSource = file?.type.startsWith("image/") ? "image" : "smartphone_video";

  const refresh = useCallback(async (opts?: { preserveError?: boolean }) => {
    if (!athleteId) return;
    // Se le catture di questo atleta sono già in cache, mostrale SUBITO (niente
    // spinner "Caricamento archivio…"); il fetch sotto aggiorna in background.
    const cached = biomechanicsCacheId === athleteId ? biomechanicsCache : null;
    if (cached) {
      setSessions(cached.sessions);
      setCaptureJobs(cached.captureJobs);
      setPendingStaging(cached.pendingStaging);
      if (cached.pendingStaging[0]?.id) {
        setReviewStagingRunId(cached.pendingStaging[0].id);
      }
      if (!opts?.preserveError) setError(cached.error);
      setLoading(false);
    } else {
      setLoading(true);
      if (!opts?.preserveError) setError(null);
    }
    try {
      const result = await fetchBiomechanicsSessions(athleteId);
      const nextPendingStaging = result.pendingStaging.map((row) => ({ id: row.id, jobId: row.jobId }));
      setSessions(result.sessions);
      setCaptureJobs(result.captureJobs);
      setPendingStaging(nextPendingStaging);
      setLastCreatedJob(null);
      if (result.pendingStaging[0]?.id) {
        setReviewStagingRunId(result.pendingStaging[0].id);
      }
      if (result.error) setError(result.error);
      biomechanicsCache = {
        sessions: result.sessions,
        captureJobs: result.captureJobs,
        pendingStaging: nextPendingStaging,
        error: result.error,
      };
      biomechanicsCacheId = athleteId;
    } catch (err) {
      if (!cached) setError(err instanceof Error ? err.message : "Biomechanics analysis unavailable.");
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    if (athleteLoading || !athleteId) return;
    void refresh();
  }, [athleteId, athleteLoading, refresh]);

  const activeJobsCount = captureJobs.filter((job) => job.status === "pending" || job.status === "processing").length;

  // Una sola CTA primaria nel primary job: quando il prossimo passo ha già
  // un'azione primaria (valida/analizza), l'upload scala a secondaria.
  const nextStepHasPrimaryCta =
    (latestJobAwaitingReview && activeStagingId != null) ||
    latestJob?.status === "pending" ||
    (latestJob?.status === "processing" && !latestJobAwaitingReview);

  async function onProcessJob(jobId: string): Promise<string | null> {
    if (!athleteId || processingJobId) return null;
    setProcessingJobId(jobId);
    setError(null);
    setMessage(null);
    try {
      const out = await processBiomechanicsCaptureJob({ athleteId, jobId });
      if (!out.ok) {
        setError(out.message || out.error || "Processing failed.");
        return null;
      }
      return out.stagingRunId ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
      return null;
    } finally {
      setProcessingJobId(null);
    }
  }

  async function onUpload() {
    if (!athleteId || !file || uploading) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const out = await uploadBiomechanicsCapture({
        athleteId,
        file,
        discipline,
        cameraPlane,
        source,
      });
      setLastCreatedJob(out.job);
      setCaptureJobs((prev) => [out.job, ...prev.filter((job) => job.id !== out.job.id)]);
      setMessage("Upload complete — analysis in progress...");
      setFile(null);
      const stagingRunId = await onProcessJob(out.job.id);
      if (stagingRunId) {
        await refresh();
        setReviewStagingRunId(stagingRunId);
        setMessage("Proposal ready — validate it to get the report.");
      } else {
        await refresh({ preserveError: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function onImportOpenCap() {
    if (!athleteId || !openCapSessionId.trim() || importingOpenCap) return;
    setImportingOpenCap(true);
    setError(null);
    setMessage(null);
    try {
      const out = await importBiomechanicsOpenCapSession({
        athleteId,
        externalSessionId: openCapSessionId.trim(),
        discipline,
      });
      if (!out.ok) {
        setError(out.message || out.error || "OpenCap import failed.");
        return;
      }
      setMessage("OpenCap session ready — validate it to confirm the report.");
      setOpenCapSessionId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OpenCap import failed.");
    } finally {
      setImportingOpenCap(false);
    }
  }

  async function runAnalyzeLatestJob() {
    if (!latestJob) return;
    setMessage("Analysis in progress...");
    const stagingRunId = await onProcessJob(latestJob.id);
    if (stagingRunId) {
      await refresh();
      setReviewStagingRunId(stagingRunId);
      setMessage("Proposal ready — validate it to generate the report.");
    } else {
      await refresh({ preserveError: true });
      setMessage(null);
    }
  }

  return (
    <Pro2AthleteRequiredGate enabled>
      <Pro2ModulePageShell
        eyebrow="Movement analysis"
        eyebrowClassName={moduleEyebrowClass("biomechanics")}
        title="Biomechanics"
        description="Upload a video of your movement: after validation with the coach you get efficiency, symmetry and risk."
      >
        <Pro2StickyAnchorSubnav
          accent={MODULE_PILL_TEAL}
          items={[
            { id: "gen-body", label: "New capture" },
            { id: "gen-domain", label: "Capture status" },
            { id: "biomech-report", label: "Session reports" },
            { id: "gen-cross", label: "Import OpenCap" },
            { id: "gen-focus", label: "Details" },
          ]}
        />

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <strong className="font-semibold">Something went wrong:</strong> {error}
          </div>
        ) : null}

        <section id="gen-body" className="scroll-mt-28">
          <Pro2SectionCard
            accent="teal"
            icon={UploadCloud}
            title="New capture"
            subtitle="Choose discipline and camera view, then upload the video: the analysis starts right away."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2 text-sm text-gray-300">
                <span className="text-xs font-medium text-gray-400">Discipline</span>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.currentTarget.value as BiomechanicsDiscipline)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  {DISCIPLINE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-300">
                <span className="text-xs font-medium text-gray-400">Camera view</span>
                <select
                  value={cameraPlane}
                  onChange={(e) => setCameraPlane(e.currentTarget.value as BiomechanicsCameraPlane)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  {CAMERA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-300 lg:min-w-72">
                <span className="text-xs font-medium text-gray-400">Video or photo</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-full file:border-0 file:bg-teal-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-teal-100"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Pro2Button
                variant={nextStepHasPrimaryCta ? "secondary" : "primary"}
                onClick={onUpload}
                disabled={!file || uploading || processingJobId != null || !athleteId}
                className="justify-center"
              >
                {uploading || processingJobId ? "Uploading and processing..." : "Upload and process"}
              </Pro2Button>
              {file ? <p className="text-xs text-gray-400">{file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p> : null}
            </div>
            <CaptureNextSteps
              latestJob={latestJob}
              awaitingReview={latestJobAwaitingReview}
              stagingRunId={activeStagingId}
              processingJobId={processingJobId}
              showTech={showTech}
              onAnalyze={() => void runAnalyzeLatestJob()}
            />
            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
                {showTech && activeStagingId && !latestJobAwaitingReview ? (
                  <>
                    {" "}
                    <ShellLink href={`/biomechanics/staging/${activeStagingId}`} className="font-semibold underline">
                      Open validation →
                    </ShellLink>
                  </>
                ) : null}
              </p>
            ) : null}
          </Pro2SectionCard>
        </section>

        <section id="gen-domain" className="scroll-mt-28">
          <Pro2SectionCard
            accent="teal"
            icon={Camera}
            title="Capture status"
            subtitle="Latest capture, archive and proposals awaiting validation."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <LatestJobCard
                job={latestJob}
                awaitingReview={latestJobAwaitingReview}
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Capture archive</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">{captureJobs.length}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {activeJobsCount} queued or processing for the active athlete.
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">To validate</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">{pendingStaging.length}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {pendingStaging.length
                    ? "Validation opens from the «New capture» panel."
                    : "No pending proposals."}
                </p>
              </div>
            </div>
          </Pro2SectionCard>
        </section>

        <section id="biomech-report" className="scroll-mt-28">
          <Pro2SectionCard
            accent="teal"
            icon={Activity}
            title="Session reports"
            subtitle="Efficiency, symmetry and risk after validation."
          >
            {loading ? (
              <p className="text-sm text-gray-400">Loading archive...</p>
            ) : (
              <SessionList sessions={sessions} />
            )}
          </Pro2SectionCard>
        </section>

        <section id="gen-cross" className="scroll-mt-28">
          <Pro2Accordion
            accent="teal"
            title="Import from OpenCap"
            subtitle="Have a session on app.opencap.ai? Import it: it follows the same validation as other captures."
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[16rem] flex-1 space-y-2 text-sm text-gray-300">
                <span className="text-xs font-medium text-gray-400">Session ID</span>
                <input
                  value={openCapSessionId}
                  onChange={(e) => setOpenCapSessionId(e.currentTarget.value)}
                  placeholder="7272a71a-e70a-4794-a253-39e11cb7542c"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </label>
              <Pro2Button
                variant="secondary"
                onClick={onImportOpenCap}
                disabled={!openCapSessionId.trim() || importingOpenCap || !athleteId}
                className="justify-center"
              >
                {importingOpenCap ? "Importing..." : "Import OpenCap"}
              </Pro2Button>
            </div>
            <p className="mt-3 text-[0.65rem] text-gray-500">
              The import uses the discipline selected in the «New capture» panel.
            </p>
          </Pro2Accordion>
        </section>

        <section id="gen-focus" className="scroll-mt-28">
          <Pro2Accordion
            accent="teal"
            title="How it works"
            subtitle="How to read the numbers and how the analysis works."
          >
            <div className="space-y-4 text-sm leading-relaxed text-gray-300">
              <div>
                <p className="font-semibold text-white">How to read the numbers</p>
                <p className="mt-1">
                  The analysis proposes points and angles from the video. Athlete and coach validate them: only after
                  confirmation do the official efficiency, symmetry and risk numbers appear.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-white">Efficiency</strong> — how economical and effective the movement is (0–100%).
                  </li>
                  <li>
                    <strong className="text-white">Symmetry</strong> — balance between the right and left sides (0–100%).
                  </li>
                  <li>
                    <strong className="text-white">Risk</strong> — probability of overload: the lower, the better.
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white">The journey of each capture</p>
                <p className="mt-1">
                  Capture (video, photo or OpenCap session) → automatic analysis → proposal to validate → confirmed
                  report with angles, joint ranges of motion (ROM) and risk by body region.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">Capture parameters</p>
                <p className="mt-1">
                  The discipline points the analysis at the right movement; the camera view indicates where the video
                  is shot from. A stable side view, with the whole body visible, gives the most reliable results.
                </p>
              </div>
            </div>
          </Pro2Accordion>
        </section>

        {showTech ? (
          <Pro2Accordion
            accent="teal"
            title="Diagnostics"
            subtitle="Technical pipeline status — visible only to coaches and staff."
          >
            <div className="space-y-1 font-mono text-xs text-gray-400">
              <p>
                Context: {role === "coach" ? "Coach" : adminScoped ? "Admin" : "Private"} · athlete{" "}
                {athleteId ? `${athleteId.slice(0, 8)}…` : "—"}
              </p>
              <p>
                Capture job: {captureJobs.length} total · {activeJobsCount} active ·{" "}
                {captureJobs.filter((job) => job.status === "failed").length} failed
              </p>
              <p>
                Last job: {latestJob ? `${latestJob.id} · ${latestJob.status} · ${latestJob.source}` : "—"}
              </p>
              <p>Active staging run: {activeStagingId ?? "—"}</p>
              <p>
                Confirmed sessions: {sessions.length} · last: {sessions[0]?.id ?? "—"}
              </p>
            </div>
          </Pro2Accordion>
        ) : null}
      </Pro2ModulePageShell>
    </Pro2AthleteRequiredGate>
  );
}
