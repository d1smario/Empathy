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
  { value: "cycling", label: "Ciclismo" },
  { value: "running", label: "Corsa" },
  { value: "walking", label: "Camminata" },
  { value: "gym", label: "Palestra" },
  { value: "movement_screening", label: "Valutazione del movimento" },
];

const CAMERA_OPTIONS: Array<{ value: BiomechanicsCameraPlane; label: string }> = [
  { value: "side", label: "Laterale" },
  { value: "front", label: "Frontale" },
  { value: "rear", label: "Posteriore" },
  { value: "oblique", label: "Obliqua" },
  { value: "multi_view", label: "Multi-vista" },
];

const SOURCE_LABELS: Record<BiomechanicsCaptureSource, string> = {
  smartphone_video: "Video smartphone",
  gopro_video: "Video action cam",
  image: "Immagine",
  manual_import: "Import manuale",
  external_pose_import: "Import esterno (OpenCap)",
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
  if (awaitingReview) return "Da validare";
  switch (job.status) {
    case "pending":
      return "In coda";
    case "processing":
      return "In elaborazione";
    case "completed":
      return "Completato";
    case "failed":
      return "Fallito";
    case "cancelled":
      return "Annullato";
  }
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

const ADMIN_SCOPE_LINK_TITLE = "Disponibile nella scheda dedicata (v2)";

/** Link verso rotte della shell coach: inerte quando la vista è montata nelle schede admin. */
function ShellLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const { athleteId, adminScoped, platformAdminView } = useActiveAthlete();
  const resolved = scopedShellHref(href, { athleteId, adminScoped, platformAdminView });
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
  const { athleteId, adminScoped, platformAdminView } = useActiveAthlete();
  const resolved = scopedShellHref(href, { athleteId, adminScoped, platformAdminView });
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
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Ultima cattura</p>
        <p className="mt-2 text-sm text-gray-300">Nessuna cattura ancora caricata.</p>
      </div>
    );
  }
  const Icon = job.status === "failed" ? AlertTriangle : awaitingReview || job.status === "completed" ? CheckCircle2 : Clock3;
  return (
    <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-teal-300" />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Ultima cattura</p>
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
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-amber-300">Prossimo passo</p>
        {showTech ? (
          <>
            <p className="mt-2 text-sm text-amber-100">
              Proposta pronta — non è ancora un report. Validala per generare efficienza, simmetria e rischio.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ShellPro2Link href={`/biomechanics/staging/${stagingRunId}`} className="justify-center">
                Valida proposta
              </ShellPro2Link>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-100">
            La tua cattura è registrata ed è in attesa di validazione dal coach. Riceverai il report quando sarà pronto.
          </p>
        )}
      </div>
    );
  }

  if (latestJob?.status === "pending") {
    return (
      <div className="mt-4 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-teal-300">Prossimo passo</p>
        <p className="mt-2 text-sm text-teal-100">
          Video in coda. Avvia l&apos;analisi per ottenere angoli e rischi proposti.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Pro2Button onClick={onAnalyze} disabled={processingJobId != null} className="justify-center">
            {processingJobId === latestJob.id ? "Analisi in corso..." : "Analizza video"}
          </Pro2Button>
        </div>
      </div>
    );
  }

  if (latestJob?.status === "processing" && !awaitingReview) {
    return (
      <div className="mt-4 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4">
        <p className="text-sm text-teal-100">Analisi interrotta o in sospeso. Riprova l&apos;analisi.</p>
        <div className="mt-3">
          <Pro2Button onClick={onAnalyze} disabled={processingJobId != null} className="justify-center">
            {processingJobId ? "Analisi in corso..." : "Riprova analisi"}
          </Pro2Button>
        </div>
      </div>
    );
  }

  if (latestJob?.status === "failed") {
    return (
      <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
        <p className="text-sm text-rose-100">
          Ultima analisi fallita{latestJob.errorMessage ? `: ${latestJob.errorMessage}` : "."} Carica di nuovo il video.
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
        <p className="text-sm font-semibold text-white">Nessun report confermato</p>
        <p className="max-w-sm text-sm text-gray-400">
          L&apos;analisi produce una <strong className="text-white">proposta da validare</strong> — il report
          (efficienza, simmetria, rischio) compare qui solo dopo la conferma.
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
              Efficienza {Math.round(session.efficiencyScores.biomechanicalEfficiency01 * 100)}% · simmetria{" "}
              {Math.round(session.efficiencyScores.symmetry01 * 100)}% · rischio{" "}
              {Math.round(session.efficiencyScores.injuryRisk01 * 100)}%
            </p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-teal-300">
            Apri report completo{" "}
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
      if (!cached) setError(err instanceof Error ? err.message : "Analisi biomeccanica non disponibile.");
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
        setError(out.message || out.error || "Elaborazione fallita.");
        return null;
      }
      return out.stagingRunId ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Elaborazione fallita.");
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
      setMessage("Caricamento completato — analisi in corso...");
      setFile(null);
      const stagingRunId = await onProcessJob(out.job.id);
      if (stagingRunId) {
        await refresh();
        setReviewStagingRunId(stagingRunId);
        setMessage("Proposta pronta — validala per ottenere il report.");
      } else {
        await refresh({ preserveError: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento non riuscito.");
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
        setError(out.message || out.error || "Import OpenCap fallito.");
        return;
      }
      setMessage("Sessione OpenCap pronta — validala per confermare il report.");
      setOpenCapSessionId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import OpenCap fallito.");
    } finally {
      setImportingOpenCap(false);
    }
  }

  async function runAnalyzeLatestJob() {
    if (!latestJob) return;
    setMessage("Analisi in corso...");
    const stagingRunId = await onProcessJob(latestJob.id);
    if (stagingRunId) {
      await refresh();
      setReviewStagingRunId(stagingRunId);
      setMessage("Proposta pronta — validala per generare il report.");
    } else {
      await refresh({ preserveError: true });
      setMessage(null);
    }
  }

  return (
    <Pro2AthleteRequiredGate enabled>
      <Pro2ModulePageShell
        eyebrow="Analisi del movimento"
        eyebrowClassName={moduleEyebrowClass("biomechanics")}
        title="Biomeccanica"
        description="Carica un video del tuo gesto: dopo la validazione con il coach ottieni efficienza, simmetria e rischio."
      >
        <Pro2StickyAnchorSubnav
          accent={MODULE_PILL_TEAL}
          items={[
            { id: "gen-body", label: "Nuova cattura" },
            { id: "gen-domain", label: "Stato catture" },
            { id: "biomech-report", label: "Report sessioni" },
            { id: "gen-cross", label: "Importa OpenCap" },
            { id: "gen-focus", label: "Dettagli" },
          ]}
        />

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <strong className="font-semibold">Qualcosa non ha funzionato:</strong> {error}
          </div>
        ) : null}

        <section id="gen-body" className="scroll-mt-28">
          <Pro2SectionCard
            accent="teal"
            icon={UploadCloud}
            title="Nuova cattura"
            subtitle="Scegli disciplina e inquadratura, poi carica il video: l'analisi parte subito."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2 text-sm text-gray-300">
                <span className="text-xs font-medium text-gray-400">Disciplina</span>
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
                <span className="text-xs font-medium text-gray-400">Inquadratura</span>
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
                <span className="text-xs font-medium text-gray-400">Video o foto</span>
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
                {uploading || processingJobId ? "Upload ed elaborazione..." : "Carica ed elabora"}
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
                      Apri validazione →
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
            title="Stato catture"
            subtitle="Ultima cattura, archivio e proposte in attesa di validazione."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <LatestJobCard
                job={latestJob}
                awaitingReview={latestJobAwaitingReview}
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Archivio catture</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">{captureJobs.length}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {activeJobsCount} in coda o in elaborazione per l&apos;atleta attivo.
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Da validare</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">{pendingStaging.length}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {pendingStaging.length
                    ? "La validazione si apre dal riquadro «Nuova cattura»."
                    : "Nessuna proposta in attesa."}
                </p>
              </div>
            </div>
          </Pro2SectionCard>
        </section>

        <section id="biomech-report" className="scroll-mt-28">
          <Pro2SectionCard
            accent="teal"
            icon={Activity}
            title="Report sessioni"
            subtitle="Efficienza, simmetria e rischio dopo la validazione."
          >
            {loading ? (
              <p className="text-sm text-gray-400">Caricamento archivio...</p>
            ) : (
              <SessionList sessions={sessions} />
            )}
          </Pro2SectionCard>
        </section>

        <section id="gen-cross" className="scroll-mt-28">
          <Pro2Accordion
            accent="teal"
            title="Importa da OpenCap"
            subtitle="Hai una sessione su app.opencap.ai? Importala: segue la stessa validazione delle altre catture."
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[16rem] flex-1 space-y-2 text-sm text-gray-300">
                <span className="text-xs font-medium text-gray-400">ID sessione</span>
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
                {importingOpenCap ? "Import..." : "Importa OpenCap"}
              </Pro2Button>
            </div>
            <p className="mt-3 text-[0.65rem] text-gray-500">
              L&apos;import usa la disciplina selezionata nel riquadro «Nuova cattura».
            </p>
          </Pro2Accordion>
        </section>

        <section id="gen-focus" className="scroll-mt-28">
          <Pro2Accordion
            accent="teal"
            title="Dettagli e motore"
            subtitle="Come leggere i numeri e come funziona l'analisi."
          >
            <div className="space-y-4 text-sm leading-relaxed text-gray-300">
              <div>
                <p className="font-semibold text-white">Come leggere i numeri</p>
                <p className="mt-1">
                  L&apos;analisi propone punti e angoli a partire dal video. Atleta e coach li validano: solo dopo la
                  conferma compaiono i numeri ufficiali di efficienza, simmetria e rischio.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-white">Efficienza</strong> — quanto il gesto è economico ed efficace (0–100%).
                  </li>
                  <li>
                    <strong className="text-white">Simmetria</strong> — equilibrio tra lato destro e sinistro (0–100%).
                  </li>
                  <li>
                    <strong className="text-white">Rischio</strong> — probabilità di sovraccarico: più è basso, meglio è.
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white">Il percorso di ogni cattura</p>
                <p className="mt-1">
                  Cattura (video, foto o sessione OpenCap) → analisi automatica → proposta da validare → report
                  confermato con angoli, escursioni articolari (ROM) e rischio per distretto.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">Parametri della cattura</p>
                <p className="mt-1">
                  La disciplina orienta l&apos;analisi sul gesto giusto; l&apos;inquadratura indica da dove è ripreso il
                  video. Una ripresa laterale stabile, con tutto il corpo visibile, dà i risultati più affidabili.
                </p>
              </div>
            </div>
          </Pro2Accordion>
        </section>

        {showTech ? (
          <Pro2Accordion
            accent="teal"
            title="Diagnostica"
            subtitle="Stato tecnico della pipeline — visibile solo a coach e staff."
          >
            <div className="space-y-1 font-mono text-xs text-gray-400">
              <p>
                Contesto: {role === "coach" ? "Coach" : adminScoped ? "Admin" : "Privato"} · atleta{" "}
                {athleteId ? `${athleteId.slice(0, 8)}…` : "—"}
              </p>
              <p>
                Capture job: {captureJobs.length} totali · {activeJobsCount} attivi ·{" "}
                {captureJobs.filter((job) => job.status === "failed").length} falliti
              </p>
              <p>
                Ultimo job: {latestJob ? `${latestJob.id} · ${latestJob.status} · ${latestJob.source}` : "—"}
              </p>
              <p>Staging run attivo: {activeStagingId ?? "—"}</p>
              <p>
                Sessioni confermate: {sessions.length} · ultima: {sessions[0]?.id ?? "—"}
              </p>
            </div>
          </Pro2Accordion>
        ) : null}
      </Pro2ModulePageShell>
    </Pro2AthleteRequiredGate>
  );
}
