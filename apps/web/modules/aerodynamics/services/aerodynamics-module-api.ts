"use client";

import type {
  AerodynamicsCameraMode,
  AerodynamicsCaptureJobV1,
  AerodynamicsCaptureSource,
  AerodynamicsEquipmentSnapshot,
  AerodynamicsPositionSnapshot,
  AerodynamicsTestSessionV1,
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

export type AerodynamicsTestsResponse = {
  tests: AerodynamicsTestSessionV1[];
  captureJobs: AerodynamicsCaptureJobV1[];
  pendingStaging: Array<{ id: string; status: string; createdAt: string; jobId: string | null }>;
  error: string | null;
};

// Righe DB lette dal browser: parità con lib/aerodynamics/aero-capture-pipeline.ts (server-only, non importabile qui).
type AeroCaptureJobRow = {
  id: string;
  athlete_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  source: AerodynamicsCaptureSource;
  camera_mode: AerodynamicsCameraMode | "unknown" | null;
  media_storage_path: string | null;
  media_content_type: string | null;
  error_message: string | null;
  result_test_session_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type AeroTestSessionRow = {
  id: string;
  athlete_id: string;
  source: AerodynamicsCaptureSource;
  recorded_at: string;
  position: AerodynamicsPositionSnapshot;
  equipment: AerodynamicsEquipmentSnapshot;
  geometry: Record<string, unknown> | null;
  cda_estimate: Record<string, unknown>;
  optimization: Record<string, unknown> | null;
  scores: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function mapAeroJobRow(row: AeroCaptureJobRow): AerodynamicsCaptureJobV1 {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    status: row.status,
    source: row.source,
    cameraMode: row.camera_mode === "unknown" || !row.camera_mode ? "side" : row.camera_mode,
    mediaStoragePath: row.media_storage_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    errorMessage: row.error_message,
  };
}

function mapAeroTestSessionRow(row: AeroTestSessionRow): AerodynamicsTestSessionV1 {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    recordedAt: row.recorded_at,
    source: row.source,
    position: row.position ?? {},
    equipment: row.equipment ?? {},
    geometry: row.geometry ?? undefined,
    cdaEstimate: row.cda_estimate as AerodynamicsTestSessionV1["cdaEstimate"],
    optimization: (row.optimization ?? undefined) as AerodynamicsTestSessionV1["optimization"],
    scores: (row.scores ?? undefined) as AerodynamicsTestSessionV1["scores"],
    payloadVersion: "aerodynamics_test_session_v1",
    payload: row.payload ?? {},
  };
}

// Lettura diretta da Supabase (RLS come guardia, filtri espliciti su athlete_id come nella vecchia route).
export async function fetchAerodynamicsTests(athleteId: string): Promise<AerodynamicsTestsResponse> {
  const empty: AerodynamicsTestsResponse = { tests: [], captureJobs: [], pendingStaging: [], error: null };
  if (!athleteId.trim()) {
    return { ...empty, error: "missing_athleteId" };
  }

  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    return { ...empty, error: "Aerodynamics non disponibile." };
  }

  const [testsRes, jobsRes, stagingRes] = await Promise.all([
    sb
      .from("aero_test_sessions")
      .select("id, athlete_id, source, recorded_at, position, equipment, geometry, cda_estimate, optimization, scores, payload, created_at")
      .eq("athlete_id", athleteId)
      .order("recorded_at", { ascending: false })
      .limit(20)
      .returns<AeroTestSessionRow[]>(),
    sb
      .from("aero_capture_jobs")
      .select(
        "id, athlete_id, status, source, camera_mode, media_storage_path, media_content_type, error_message, result_test_session_id, created_at, updated_at",
      )
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<AeroCaptureJobRow[]>(),
    sb
      .from("interpretation_staging_runs")
      .select("id, status, created_at, candidate_bundle")
      .eq("athlete_id", athleteId)
      .eq("domain", "aerodynamics")
      .eq("status", "pending_validation")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (testsRes.error) {
    return { ...empty, error: testsRes.error.message || "aero_test_sessions_read_failed" };
  }
  if (jobsRes.error) {
    return { ...empty, error: jobsRes.error.message || "aero_capture_jobs_read_failed" };
  }
  // Tabella staging opzionale: se manca la trattiamo come lista vuota (parità con la lib server).
  if (stagingRes.error && !stagingRes.error.message?.includes("interpretation_staging_runs")) {
    return { ...empty, error: stagingRes.error.message || "aero_staging_list_failed" };
  }

  const pendingStaging = (stagingRes.error ? [] : stagingRes.data ?? []).map((row) => {
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

  return {
    tests: (testsRes.data ?? []).map(mapAeroTestSessionRow),
    captureJobs: (jobsRes.data ?? []).map(mapAeroJobRow),
    pendingStaging,
    error: null,
  };
}

async function requestAerodynamicsSignUpload(input: { athleteId: string; file: File }): Promise<SignUploadOk> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/aerodynamics/capture/sign-upload", {
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
    throw new Error(apiErrorMessage(json, "Firma upload Aerodynamics non riuscita."));
  }
  return json;
}

export async function uploadAerodynamicsCapture(input: {
  athleteId: string;
  file: File;
  source: AerodynamicsCaptureSource;
  cameraMode: AerodynamicsCameraMode;
}): Promise<{ job: AerodynamicsCaptureJobV1 }> {
  const sign = await requestAerodynamicsSignUpload({ athleteId: input.athleteId, file: input.file });
  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    throw new Error("Client Supabase non disponibile.");
  }

  const { error: uploadError } = await sb.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, input.file);
  if (uploadError) {
    throw new Error(uploadError.message || "Upload Aerodynamics fallito.");
  }

  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/aerodynamics/capture", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      athleteId: input.athleteId,
      source: input.source,
      cameraMode: input.cameraMode,
      storage: { bucket: sign.bucket, objectPath: sign.objectPath },
      mediaContentType: input.file.type,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as ({ ok: true; job: AerodynamicsCaptureJobV1 } & Record<string, unknown>) | ApiError;
  if (!res.ok || !json.ok) {
    throw new Error(apiErrorMessage(json, "Creazione job Aerodynamics non riuscita."));
  }
  return { job: json.job };
}

export async function processAerodynamicsCaptureJob(input: {
  athleteId: string;
  jobId: string;
}): Promise<{ ok: boolean; stagingRunId?: string; error?: string; message?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/aerodynamics/capture/process", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Elaborazione CV fallita."), message: String(json.message ?? "") };
  }
  return { ok: true, stagingRunId: typeof json.stagingRunId === "string" ? json.stagingRunId : undefined };
}

export async function fetchAerodynamicsStagingRunDetail(runId: string): Promise<{
  ok: boolean;
  run?: Record<string, unknown>;
  signedUrl?: string | null;
  scenarioCompare?: import("@empathy/contracts").AerodynamicsScenarioCompareV1 | null;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(`/api/aerodynamics/staging-runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Staging non disponibile.") };
  }
  return {
    ok: true,
    run: json.run as Record<string, unknown>,
    signedUrl: typeof json.signedUrl === "string" ? json.signedUrl : null,
    scenarioCompare: (json.scenarioCompare as import("@empathy/contracts").AerodynamicsScenarioCompareV1 | null) ?? null,
  };
}

export async function applyAerodynamicsStagingRun(
  runId: string,
  selectedScenarioId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/aerodynamics/staging-runs/${encodeURIComponent(runId)}/apply`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ selectedScenarioId: selectedScenarioId ?? "baseline" }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Conferma fallita.") };
  }
  return { ok: true };
}

export async function rejectAerodynamicsStagingRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/aerodynamics/staging-runs/${encodeURIComponent(runId)}/apply`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ status: "rejected" }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.ok) {
    return { ok: false, error: apiErrorMessage(json, "Rifiuto fallito.") };
  }
  return { ok: true };
}
