"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bike, CheckCircle2, Clock3, UploadCloud, Wind } from "lucide-react";
import type {
  AerodynamicsCameraMode,
  AerodynamicsCaptureJobV1,
  AerodynamicsCaptureSource,
  AerodynamicsTestSessionV1,
} from "@empathy/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Accordion, Pro2Button, Pro2Link, pro2ButtonClassName } from "@/components/ui/empathy";
import { coachAthleteStagingHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  fetchAerodynamicsTests,
  processAerodynamicsCaptureJob,
  uploadAerodynamicsCapture,
} from "@/modules/aerodynamics/services/aerodynamics-module-api";

const CAMERA_OPTIONS: Array<{ value: AerodynamicsCameraMode; label: string }> = [
  { value: "side", label: "Laterale" },
  { value: "front", label: "Frontale" },
  { value: "rear", label: "Posteriore" },
  { value: "multi_view", label: "Multi-view" },
  { value: "three_sixty", label: "360°" },
];

const SOURCE_LABELS: Record<AerodynamicsCaptureSource, string> = {
  smartphone_video: "Video smartphone",
  gopro_video: "Video GoPro",
  image: "Foto",
  manual_test: "Test manuale",
  external_aero_import: "Import esterno",
};

function cameraLabel(mode: AerodynamicsCameraMode): string {
  return CAMERA_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(job: AerodynamicsCaptureJobV1, awaitingReview: boolean): string {
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

function LatestAeroJobCard({
  job,
  awaitingReview,
}: {
  job: AerodynamicsCaptureJobV1 | null;
  awaitingReview: boolean;
}) {
  if (!job) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Ultima cattura</p>
        <p className="mt-2 text-sm text-gray-300">Nessuna cattura aero caricata.</p>
      </div>
    );
  }
  const Icon = job.status === "failed" ? AlertTriangle : awaitingReview || job.status === "completed" ? CheckCircle2 : Clock3;
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-sky-400" />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Ultima cattura</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{statusLabel(job, awaitingReview)}</p>
      <p className="mt-1 text-xs text-gray-400">
        {SOURCE_LABELS[job.source]} · {cameraLabel(job.cameraMode)} · {formatDateTime(job.createdAt)}
      </p>
      {job.errorMessage ? <p className="mt-2 text-xs text-rose-200">{job.errorMessage}</p> : null}
    </div>
  );
}

// Cache cross-mount dei test/job aero: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner "Caricamento archivio..."); il refetch avviene
// sempre in background silenzioso, così upload/elaborazione restano riflessi.
let aeroTestsCacheId: string | null = null;
let aeroTestsCache: Awaited<ReturnType<typeof fetchAerodynamicsTests>> | null = null;

function AeroTestList({ tests }: { tests: AerodynamicsTestSessionV1[] }) {
  if (!tests.length) {
    return (
      <p className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
        Nessun test aero confermato. Elabora una cattura, valida la proposta e conferma per ottenere il CdA.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {tests.slice(0, 5).map((test) => (
        <div key={test.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-sky-500/40 hover:bg-white/[0.05]">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">CdA</p>
          <p className="mt-1">
            <span className="font-mono text-lg font-semibold tabular-nums text-white">
              {Number.isFinite(test.cdaEstimate.cdaM2) ? test.cdaEstimate.cdaM2.toFixed(3) : "—"}
            </span>
            <span className="ml-1 text-xs font-medium text-gray-500">m²</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {formatDateTime(test.recordedAt)} · {SOURCE_LABELS[test.source]} · affidabilità{" "}
            {(test.cdaEstimate.confidence01 * 100).toFixed(0)}%
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AerodynamicsPageView() {
  const { athleteId, loading: athleteLoading, adminScoped, platformAdminView, role } = useActiveAthlete();
  const [cameraMode, setCameraMode] = useState<AerodynamicsCameraMode>("side");
  const [file, setFile] = useState<File | null>(null);
  const [tests, setTests] = useState<AerodynamicsTestSessionV1[]>([]);
  const [captureJobs, setCaptureJobs] = useState<AerodynamicsCaptureJobV1[]>([]);
  const [pendingStaging, setPendingStaging] = useState<Array<{ id: string; jobId: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewStagingRunId, setReviewStagingRunId] = useState<string | null>(null);

  const showTech = role === "coach" || adminScoped;
  const latestJob = captureJobs[0] ?? null;
  const latestJobStaging = pendingStaging.find((row) => row.jobId === latestJob?.id) ?? pendingStaging[0] ?? null;
  const latestJobAwaitingReview = Boolean(latestJob && latestJobStaging);
  const source: AerodynamicsCaptureSource = file?.type.startsWith("image/") ? "image" : "smartphone_video";
  const latestCda = tests[0]?.cdaEstimate.cdaM2;

  const applyAeroResult = useCallback((result: Awaited<ReturnType<typeof fetchAerodynamicsTests>>) => {
    setTests(result.tests);
    setCaptureJobs(result.captureJobs);
    setPendingStaging(result.pendingStaging.map((row) => ({ id: row.id, jobId: row.jobId })));
  }, []);

  const refresh = useCallback(async () => {
    if (!athleteId) return;
    // Se i dati di questo atleta sono già in cache, mostrali SUBITO (niente
    // spinner "Caricamento archivio..."); il refetch sotto gira sempre in background.
    const cached = aeroTestsCacheId === athleteId ? aeroTestsCache : null;
    if (cached) {
      applyAeroResult(cached);
      setError(cached.error);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await fetchAerodynamicsTests(athleteId);
      applyAeroResult(result);
      setError(result.error ?? null);
      aeroTestsCache = result;
      aeroTestsCacheId = athleteId;
    } catch (err) {
      if (!cached) setError(err instanceof Error ? err.message : "Aerodynamics non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [athleteId, applyAeroResult]);

  useEffect(() => {
    if (athleteLoading || !athleteId) return;
    void refresh();
  }, [athleteId, athleteLoading, refresh]);

  const captureCountLabel = useMemo(() => {
    const active = captureJobs.filter((job) => job.status === "pending" || job.status === "processing").length;
    return `${captureJobs.length} catture · ${active} in lavorazione`;
  }, [captureJobs]);

  async function onProcessJob(jobId: string): Promise<string | null> {
    if (!athleteId || processingJobId) return null;
    setProcessingJobId(jobId);
    setError(null);
    setMessage(null);
    try {
      const out = await processAerodynamicsCaptureJob({ athleteId, jobId });
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
      const out = await uploadAerodynamicsCapture({
        athleteId,
        file,
        source,
        cameraMode,
      });
      setMessage("Caricamento completato — elaborazione in corso...");
      setFile(null);
      const stagingRunId = await onProcessJob(out.job.id);
      await refresh();
      if (stagingRunId) {
        setReviewStagingRunId(stagingRunId);
        setMessage("Proposta pronta — conferma per ottenere il CdA.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload Aerodynamics fallito.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pro2AthleteRequiredGate enabled>
      <Pro2ModulePageShell
        eyebrow="Posizione in sella"
        eyebrowClassName="text-sky-400"
        title="Aerodinamica"
        description="Carica un video o una foto della tua posizione in sella: tu e il coach la validate e ottieni il CdA stimato."
      >
        <div className="scroll-mt-28">
          <GenerativeModuleSubnav />
        </div>

        <section id="gen-domain" className="scroll-mt-28">
          <Pro2SectionCard
            accent="sky"
            icon={UploadCloud}
            title="Nuova cattura aero"
            subtitle="Inquadra ciclista e bici: posizione, casco, ruote, cockpit, borracce. Formati supportati: MP4, MOV, JPEG, PNG, WEBP."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-300">
                <span className="text-xs font-medium text-gray-400">Inquadratura</span>
                <select
                  value={cameraMode}
                  onChange={(e) => setCameraMode(e.currentTarget.value as AerodynamicsCameraMode)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  {CAMERA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-300">
                <span className="text-xs font-medium text-gray-400">Video o foto</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sky-100"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Pro2Button onClick={onUpload} disabled={!file || uploading || processingJobId != null || !athleteId} className="justify-center">
                {uploading || processingJobId ? "Upload ed elaborazione..." : "Carica ed elabora"}
              </Pro2Button>
              {file ? <p className="text-xs text-gray-400">{file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p> : null}
            </div>
            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
                {showTech && (reviewStagingRunId ?? latestJobStaging?.id) ? (
                  <>
                    {" "}
                    {!adminScoped ? (
                      <Link href={`/aerodynamics/staging/${reviewStagingRunId ?? latestJobStaging?.id}`} className="font-semibold underline">
                        Apri review →
                      </Link>
                    ) : !platformAdminView && athleteId ? (
                      <Link
                        href={coachAthleteStagingHref(athleteId, "aerodynamics", String(reviewStagingRunId ?? latestJobStaging?.id))}
                        className="font-semibold underline"
                      >
                        Apri review →
                      </Link>
                    ) : (
                      <span className="font-semibold underline cursor-default opacity-50" title="Disponibile nella scheda dedicata (v2)">
                        Apri review →
                      </span>
                    )}
                  </>
                ) : null}
              </p>
            ) : null}
            {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          </Pro2SectionCard>
        </section>

        <section id="gen-body" className="scroll-mt-28">
          <Pro2SectionCard
            accent="sky"
            icon={Wind}
            title="Stato e risultati"
            subtitle="Le tue catture restano private; ogni caricamento avvia un'elaborazione dedicata."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <LatestAeroJobCard
                job={latestJob}
                awaitingReview={latestJobAwaitingReview}
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Archivio catture</p>
                <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-white">{captureCountLabel}</p>
                <p className="mt-1 text-xs text-gray-400">Le catture più recenti dell&apos;atleta attivo.</p>
              </div>
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">CdA corrente</p>
                <p className="mt-1">
                  <span className="font-mono text-2xl font-bold tabular-nums text-sky-50">
                    {typeof latestCda === "number" ? latestCda.toFixed(3) : "—"}
                  </span>
                  {typeof latestCda === "number" ? (
                    <span className="ml-1 text-xs font-medium text-gray-500">m²</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-gray-400">Solo da un test validato.</p>
              </div>
            </div>
            {showTech && pendingStaging.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {pendingStaging.length} proposte da validare —{" "}
                {!adminScoped ? (
                  <Link href={`/aerodynamics/staging/${pendingStaging[0]!.id}`} className="underline">
                    apri validazione
                  </Link>
                ) : !platformAdminView && athleteId ? (
                  <Link href={coachAthleteStagingHref(athleteId, "aerodynamics", pendingStaging[0]!.id)} className="underline">
                    apri validazione
                  </Link>
                ) : (
                  <span className="underline cursor-default opacity-50" title="Disponibile nella scheda dedicata (v2)">
                    apri validazione
                  </span>
                )}
              </div>
            ) : null}
            <div className="mt-4">
              <Pro2Accordion
                title="Storico test validati"
                subtitle="CdA, data e affidabilità degli ultimi test confermati."
                accent="sky"
              >
                {loading ? <p className="text-sm text-gray-400">Caricamento archivio...</p> : <AeroTestList tests={tests} />}
              </Pro2Accordion>
            </div>
          </Pro2SectionCard>
        </section>

        <section id="gen-cross" className="scroll-mt-28">
          <Pro2SectionCard
            accent="sky"
            icon={Bike}
            title="Collegamenti"
            subtitle="La posizione validata alimenta anche allenamento e analisi del movimento."
          >
            <div className="flex flex-wrap gap-2">
              {adminScoped ? (
                // In scheda admin i link cross-shell sono inerti (v2)
                <>
                  <span
                    className={pro2ButtonClassName("secondary", "justify-center border-sky-500/30 bg-sky-500/10 text-sky-100 cursor-default opacity-50")}
                    title="Disponibile nella scheda dedicata (v2)"
                  >
                    Training
                  </span>
                  <span
                    className={pro2ButtonClassName("ghost", "justify-center border border-sky-500/30 bg-sky-500/10 text-sky-100 cursor-default opacity-50")}
                    title="Disponibile nella scheda dedicata (v2)"
                  >
                    Biomechanics
                  </span>
                </>
              ) : (
                <>
                  <Pro2Link
                    href="/training"
                    variant="secondary"
                    className="justify-center border-sky-500/30 bg-sky-500/10 text-sky-100 hover:border-sky-400/50 hover:bg-sky-500/20"
                  >
                    Training
                  </Pro2Link>
                  <Pro2Link
                    href="/biomechanics"
                    variant="ghost"
                    className="justify-center border border-sky-500/30 bg-sky-500/10 text-sky-100 hover:border-sky-400/50 hover:bg-sky-500/20"
                  >
                    Biomechanics
                  </Pro2Link>
                </>
              )}
            </div>
          </Pro2SectionCard>
        </section>

        <section id="gen-focus" className="scroll-mt-28">
          <Pro2Accordion
            title="Dettagli e motore"
            subtitle="Come leggere i numeri e come nasce la stima del CdA."
            accent="sky"
          >
            <div className="space-y-3 text-sm leading-relaxed text-gray-300">
              <p>
                Dal materiale caricato ricostruiamo la tua posizione in sella e proponiamo alcuni scenari. Quando ne
                confermi uno, calcoliamo CdA, watt e secondi risparmiati. I valori sono stime di modello, non misure in
                galleria del vento.
              </p>
              <p>
                Il percorso del dato: carichi la cattura, parte l&apos;elaborazione, ricevi una proposta da validare e solo
                dopo la conferma il test diventa definitivo con il suo CdA. Gli scenari di posizione sono sempre validati
                prima di diventare definitivi.
              </p>
              <p>
                Le inquadrature disponibili sono {CAMERA_OPTIONS.map((option) => option.label).join(", ")}: più punti di
                vista carichi, più la ricostruzione della posizione è affidabile.
              </p>
            </div>
          </Pro2Accordion>
        </section>

        {showTech ? (
          <Pro2Accordion
            title="Diagnostica"
            subtitle="Dati grezzi di job e proposte — visibile solo a coach e admin."
            accent="sky"
          >
            <div className="space-y-3 font-mono text-xs text-gray-400">
              <p>athleteId: {athleteId ?? "—"}</p>
              <div>
                <p className="text-gray-500">captureJobs ({captureJobs.length})</p>
                {captureJobs.slice(0, 5).map((job) => (
                  <p key={job.id} className="mt-1 break-all">
                    {job.id} · {job.status} · {job.source} · {job.cameraMode} · {job.createdAt}
                    {job.errorMessage ? ` · ${job.errorMessage}` : ""}
                  </p>
                ))}
                {!captureJobs.length ? <p className="mt-1">—</p> : null}
              </div>
              <div>
                <p className="text-gray-500">pendingStaging ({pendingStaging.length})</p>
                {pendingStaging.map((row) => (
                  <p key={row.id} className="mt-1 break-all">
                    {row.id} · job {row.jobId ?? "—"}
                  </p>
                ))}
                {!pendingStaging.length ? <p className="mt-1">—</p> : null}
              </div>
              <div>
                <p className="text-gray-500">tests ({tests.length})</p>
                {tests.slice(0, 5).map((test) => (
                  <p key={test.id} className="mt-1 break-all">
                    {test.id} · {test.recordedAt} · cda {test.cdaEstimate.cdaM2} · method {test.cdaEstimate.method}
                  </p>
                ))}
                {!tests.length ? <p className="mt-1">—</p> : null}
              </div>
            </div>
          </Pro2Accordion>
        ) : null}

        {showTech && latestJob?.status === "pending" && !latestJobAwaitingReview ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Pro2Button
              variant="secondary"
              onClick={() => void onProcessJob(latestJob.id).then(async (stagingRunId) => {
                await refresh();
                if (stagingRunId) {
                  setReviewStagingRunId(stagingRunId);
                  setMessage("Proposta pronta — conferma per ottenere il CdA.");
                }
              })}
              disabled={processingJobId != null}
              className="justify-center"
            >
              {processingJobId === latestJob.id ? "Elaborazione..." : "Elabora ultima cattura"}
            </Pro2Button>
            <p className="text-xs text-gray-500">Ri-elabora l&apos;ultima cattura in coda.</p>
          </div>
        ) : null}
      </Pro2ModulePageShell>
    </Pro2AthleteRequiredGate>
  );
}
