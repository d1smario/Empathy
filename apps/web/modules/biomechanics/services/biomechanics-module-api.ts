"use client";

import type {
  BiomechanicsCameraPlane,
  BiomechanicsCaptureJobV1,
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsSessionImportV1,
} from "@empathy/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type SignUploadOk = {
  ok: true;
  bucket: string;
  path: string;
  token: string;
  objectPath: string;
};

type ApiError = { ok?: false; error?: string };

function apiErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "error" in json) {
    const error = (json as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

export type BiomechanicsSessionsResponse = {
  sessions: BiomechanicsSessionImportV1[];
  captureJobs: BiomechanicsCaptureJobV1[];
  pendingStaging: Array<{ id: string; status: string; createdAt: string; jobId: string | null }>;
  error: string | null;
};

// ── Letture dirette da Supabase (ex /api/biomechanics/sessions) ─────────────
// Replica client-side delle letture di lib/biomechanics/biomech-capture-pipeline.ts
// (lib server-only condivisa con altre route: tenere allineati select e mapping).
// RLS filtra per utente; il filtro esplicito su athlete_id resta funzionale.

type BiomechDbModality = "gym" | "running" | "cycling" | "field_sport" | "other";
type BiomechDbCameraPlane = "sagittal" | "frontal" | "oblique" | "multiview" | "unknown";

const BIOMECH_JOB_SELECT =
  "id, athlete_id, status, modality, stated_exercise_id, camera_plane, media_storage_path, media_content_type, source, provider, external_session_id, error_message, result_import_id, created_at, updated_at";

const BIOMECH_JOB_SELECT_LEGACY =
  "id, athlete_id, status, modality, stated_exercise_id, camera_plane, media_storage_path, media_content_type, error_message, result_import_id, created_at, updated_at";

type BiomechCaptureJobRow = {
  id: string;
  athlete_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  modality: BiomechDbModality | null;
  stated_exercise_id: string | null;
  camera_plane: BiomechDbCameraPlane | null;
  media_storage_path: string | null;
  media_content_type: string | null;
  source: string | null;
  provider: string | null;
  external_session_id: string | null;
  error_message: string | null;
  result_import_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type BiomechSessionImportRow = {
  id: string;
  athlete_id: string;
  source: string;
  recorded_at: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type BiomechStagingRunRow = {
  id: string;
  status: string;
  created_at: string;
  candidate_bundle: unknown;
};

function isMissingColumnError(error: { message?: string } | null | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find"));
}

function mapBiomechJobRow(row: BiomechCaptureJobRow): BiomechanicsCaptureJobV1 {
  const source =
    typeof row.source === "string" && row.source.trim()
      ? (row.source as BiomechanicsCaptureSource)
      : "smartphone_video";
  return {
    id: row.id,
    athleteId: row.athlete_id,
    status: row.status,
    source,
    discipline: row.modality === "cycling" || row.modality === "running" || row.modality === "gym" ? row.modality : "movement_screening",
    cameraPlane:
      row.camera_plane === "frontal"
        ? "front"
        : row.camera_plane === "sagittal"
          ? "side"
          : row.camera_plane === "oblique"
            ? "oblique"
            : row.camera_plane === "multiview"
              ? "multi_view"
              : "rear",
    mediaStoragePath: row.media_storage_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    errorMessage: row.error_message,
  };
}

function mapBiomechSessionImportRow(row: BiomechSessionImportRow): BiomechanicsSessionImportV1 {
  const payload = row.payload;
  const discipline =
    typeof payload.discipline === "string"
      ? (payload.discipline as BiomechanicsDiscipline)
      : "movement_screening";
  const source =
    typeof row.source === "string" && row.source.trim()
      ? (row.source as BiomechanicsCaptureSource)
      : "manual_import";
  return {
    id: row.id,
    athleteId: row.athlete_id,
    recordedAt: row.recorded_at,
    source,
    discipline,
    calibration: payload.calibration as BiomechanicsSessionImportV1["calibration"],
    landmarks: Array.isArray(payload.landmarks) ? (payload.landmarks as BiomechanicsSessionImportV1["landmarks"]) : undefined,
    jointAngles: Array.isArray(payload.jointAngles) ? (payload.jointAngles as BiomechanicsSessionImportV1["jointAngles"]) : undefined,
    anthropometrics: payload.anthropometrics as BiomechanicsSessionImportV1["anthropometrics"],
    movementPatterns: payload.movementPatterns as BiomechanicsSessionImportV1["movementPatterns"],
    riskScores: payload.riskScores as BiomechanicsSessionImportV1["riskScores"],
    efficiencyScores: payload.efficiencyScores as BiomechanicsSessionImportV1["efficiencyScores"],
    payloadVersion: "biomechanics_session_import_v1",
    payload,
  };
}

async function listBiomechanicsSessionImportsFromDb(
  sb: NonNullable<ReturnType<typeof createEmpathyBrowserSupabase>>,
  athleteId: string,
): Promise<BiomechanicsSessionImportV1[]> {
  const { data, error } = await sb
    .from("biomech_session_imports")
    .select("id, athlete_id, source, recorded_at, payload, created_at")
    .eq("athlete_id", athleteId)
    .order("recorded_at", { ascending: false })
    .limit(20)
    .returns<BiomechSessionImportRow[]>();

  if (error) {
    throw new Error(error.message || "biomech_session_imports_read_failed");
  }
  return (data ?? []).map(mapBiomechSessionImportRow);
}

async function listBiomechanicsCaptureJobsFromDb(
  sb: NonNullable<ReturnType<typeof createEmpathyBrowserSupabase>>,
  athleteId: string,
): Promise<BiomechanicsCaptureJobV1[]> {
  let result = await sb
    .from("biomech_capture_jobs")
    .select(BIOMECH_JOB_SELECT)
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<BiomechCaptureJobRow[]>();

  // Fallback per schemi legacy senza le colonne source/provider/external_session_id.
  if (result.error && isMissingColumnError(result.error)) {
    result = await sb
      .from("biomech_capture_jobs")
      .select(BIOMECH_JOB_SELECT_LEGACY)
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<BiomechCaptureJobRow[]>();
  }

  if (result.error) {
    throw new Error(result.error.message || "biomech_capture_jobs_read_failed");
  }
  return (result.data ?? []).map(mapBiomechJobRow);
}

async function listPendingBiomechanicsStagingRunsFromDb(
  sb: NonNullable<ReturnType<typeof createEmpathyBrowserSupabase>>,
  athleteId: string,
): Promise<BiomechanicsSessionsResponse["pendingStaging"]> {
  const { data, error } = await sb
    .from("interpretation_staging_runs")
    .select("id, status, created_at, candidate_bundle")
    .eq("athlete_id", athleteId)
    .eq("domain", "biomechanics")
    .eq("status", "pending_validation")
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<BiomechStagingRunRow[]>();

  if (error) {
    // Tabella opzionale: se assente lo staging è semplicemente vuoto.
    if (error.message?.includes("interpretation_staging_runs")) return [];
    throw new Error(error.message || "biomech_staging_list_failed");
  }

  return (data ?? []).map((row) => {
    const bundle =
      row.candidate_bundle && typeof row.candidate_bundle === "object" && !Array.isArray(row.candidate_bundle)
        ? (row.candidate_bundle as Record<string, unknown>)
        : {};
    return {
      id: String(row.id),
      status: String(row.status),
      createdAt: String(row.created_at),
      jobId: typeof bundle.captureJobId === "string" ? bundle.captureJobId : null,
    };
  });
}

export async function fetchBiomechanicsSessions(athleteId: string): Promise<BiomechanicsSessionsResponse> {
  const normalizedAthleteId = athleteId.trim();
  if (!normalizedAthleteId) {
    return { sessions: [], captureJobs: [], pendingStaging: [], error: "missing_athleteId" };
  }

  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    return { sessions: [], captureJobs: [], pendingStaging: [], error: "Biomechanics unavailable." };
  }

  try {
    const [sessions, captureJobs, pendingStaging] = await Promise.all([
      listBiomechanicsSessionImportsFromDb(sb, normalizedAthleteId),
      listBiomechanicsCaptureJobsFromDb(sb, normalizedAthleteId),
      listPendingBiomechanicsStagingRunsFromDb(sb, normalizedAthleteId),
    ]);
    return { sessions, captureJobs, pendingStaging, error: null };
  } catch (err) {
    const message = err instanceof Error && err.message.trim() ? err.message : "Biomechanics unavailable.";
    return { sessions: [], captureJobs: [], pendingStaging: [], error: message };
  }
}

export async function fetchBiomechanicsSessionDetail(input: {
  athleteId: string;
  sessionId: string;
}): Promise<{ ok: boolean; session?: BiomechanicsSessionImportV1; signedUrl?: string | null; error?: string }> {
  const url = `/api/biomechanics/sessions/${encodeURIComponent(input.sessionId)}?athleteId=${encodeURIComponent(input.athleteId)}`;
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as
    | ({ ok: true; session?: BiomechanicsSessionImportV1; signedUrl?: string | null } & Record<string, unknown>)
    | ApiError;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Session report unavailable.") };
  }
  if (!json.session) {
    return { ok: false, error: "session_not_found" };
  }
  return {
    ok: true,
    session: json.session,
    signedUrl: typeof json.signedUrl === "string" ? json.signedUrl : null,
  };
}

async function requestBiomechanicsSignUpload(input: { athleteId: string; file: File }): Promise<SignUploadOk> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/capture/sign-upload", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      athleteId: input.athleteId,
      fileName: input.file.name,
      contentType: input.file.type,
      fileSizeBytes: input.file.size,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as SignUploadOk | ApiError;
  if (!res.ok || !json.ok) {
    throw new Error(apiErrorMessage(json, "Biomechanics upload signing failed."));
  }
  return json;
}

export async function uploadBiomechanicsCapture(input: {
  athleteId: string;
  file: File;
  discipline: BiomechanicsDiscipline;
  source: BiomechanicsCaptureSource;
  cameraPlane: BiomechanicsCameraPlane;
  statedExerciseId?: string | null;
}): Promise<{ job: BiomechanicsCaptureJobV1 }> {
  const sign = await requestBiomechanicsSignUpload({ athleteId: input.athleteId, file: input.file });
  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    throw new Error("Supabase client unavailable.");
  }

  const { error: uploadError } = await sb.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, input.file);
  if (uploadError) {
    throw new Error(uploadError.message || "Biomechanics upload failed.");
  }

  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/capture", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      athleteId: input.athleteId,
      discipline: input.discipline,
      source: input.source,
      cameraPlane: input.cameraPlane,
      storage: { bucket: sign.bucket, objectPath: sign.objectPath },
      mediaContentType: input.file.type,
      statedExerciseId: input.statedExerciseId ?? null,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as ({ ok: true; job: BiomechanicsCaptureJobV1 } & Record<string, unknown>) | ApiError;
  if (!res.ok || !json.ok) {
    throw new Error(apiErrorMessage(json, "Biomechanics job creation failed."));
  }
  return { job: json.job };
}

export async function processBiomechanicsCaptureJob(input: {
  athleteId: string;
  jobId: string;
}): Promise<{ ok: boolean; stagingRunId?: string; error?: string; message?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/capture/process", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    const message = typeof json.message === "string" && json.message.trim() ? json.message : undefined;
    const code = typeof json.code === "string" ? json.code : undefined;
    return {
      ok: false,
      error: message ?? apiErrorMessage(json, "CV processing failed."),
      message: message ?? code ?? "",
    };
  }
  return { ok: true, stagingRunId: typeof json.stagingRunId === "string" ? json.stagingRunId : undefined };
}

export async function fetchBiomechanicsStagingRunDetail(runId: string): Promise<{
  ok: boolean;
  run?: Record<string, unknown>;
  signedUrl?: string | null;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Staging unavailable.") };
  }
  return {
    ok: true,
    run: json.run as Record<string, unknown>,
    signedUrl: typeof json.signedUrl === "string" ? json.signedUrl : null,
  };
}

export async function saveBiomechanicsStagingPoseCorrection(input: {
  runId: string;
  landmarks: import("@empathy/contracts").BiomechanicsLandmark3D[];
  jointAngles: import("@empathy/contracts").BiomechanicsJointAngleSample[];
}): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(input.runId)}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      landmarks: input.landmarks,
      jointAngles: input.jointAngles,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Correction save failed.") };
  }
  return { ok: true };
}

export async function applyBiomechanicsStagingRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(runId)}/apply`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({}),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Confirmation failed.") };
  }
  return { ok: true };
}

export async function rejectBiomechanicsStagingRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/biomechanics/staging-runs/${encodeURIComponent(runId)}/apply`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ status: "rejected" }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Rejection failed.") };
  }
  return { ok: true };
}

export async function importBiomechanicsOpenCapSession(input: {
  athleteId: string;
  externalSessionId: string;
  discipline: import("@empathy/contracts").BiomechanicsDiscipline;
}): Promise<{ ok: boolean; stagingRunId?: string; error?: string; message?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/biomechanics/sessions/import", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      error: apiErrorMessage(json, "OpenCap import failed."),
      message: String(json.message ?? ""),
    };
  }
  return {
    ok: true,
    stagingRunId: typeof json.stagingRunId === "string" ? json.stagingRunId : undefined,
  };
}
