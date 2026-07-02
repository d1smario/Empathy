import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { isMissingRelationError } from "@/lib/supabase/missing-relation-error";

export type HealthPanelTimelineRow = {
  id: string;
  type: string;
  sample_date: string | null;
  reported_at: string | null;
  source: string | null;
  values: Record<string, unknown> | null;
  created_at: string | null;
};

export type HealthTimelineFetchDiagnostics = {
  /** `athleteId` della query (sempre presente quando l'API risponde). */
  requestedAthleteId?: string | null;
  /** `app_user_profiles.athlete_id` dell'utente autenticato (quando server ha potuto leggerlo). */
  userProfileAthleteId?: string | null;
  /** Codice errore strutturato emesso dall'API. */
  errorCode?: string | null;
  /** Status HTTP osservato dall'ultima richiesta. */
  httpStatus?: number;
};

/**
 * Diagnostica leggera quando la lettura fallisce: espone l'`athlete_id`
 * collegato al profilo dell'utente autenticato (`app_user_profiles`), così la UI
 * può spiegare un eventuale mismatch tra atleta attivo client e profilo (parità
 * con la vecchia diagnostica 401/403 dell'API).
 */
async function readUserProfileAthleteId(sb: SupabaseClient): Promise<string | null> {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return null;
    const { data } = await sb
      .from("app_user_profiles")
      .select("athlete_id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as { athlete_id?: string | null } | null)?.athlete_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Archivio panel + diagnostica leggera. Lettura diretta da Supabase (RLS come
 * guardia, filtro esplicito su `athlete_id` come nella vecchia route): serie
 * temporale per grafici Health e archivio (valori strutturati in `values` JSON).
 */
export async function fetchHealthPanelsTimeline(athleteId: string): Promise<{
  panels: HealthPanelTimelineRow[];
  error: string | null;
  diagnostics: HealthTimelineFetchDiagnostics;
}> {
  const requestedAthleteId = athleteId.trim();
  if (!requestedAthleteId) {
    return {
      panels: [],
      error: humanizeTimelineError("missing_athleteId"),
      diagnostics: { requestedAthleteId: athleteId, errorCode: "missing_athleteId" },
    };
  }

  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    return {
      panels: [],
      error: humanizeTimelineError("supabase_unconfigured"),
      diagnostics: { requestedAthleteId, errorCode: "supabase_unconfigured" },
    };
  }

  const { data, error } = await sb
    .from("biomarker_panels")
    .select("id, type, sample_date, reported_at, source, values, created_at")
    .eq("athlete_id", requestedAthleteId)
    .order("sample_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(48);

  if (error) {
    return {
      panels: [],
      error: humanizeTimelineError(error.message),
      diagnostics: {
        requestedAthleteId,
        userProfileAthleteId: await readUserProfileAthleteId(sb),
        errorCode: error.message,
      },
    };
  }

  return {
    panels: (data ?? []) as HealthPanelTimelineRow[],
    error: null,
    diagnostics: { requestedAthleteId },
  };
}

function humanizeTimelineError(code: string): string {
  switch (code) {
    case "missing_athleteId":
      return "Athlete not specified (athleteId empty).";
    case "unauthorized":
      return "Session expired: sign in again to reload the archive.";
    case "forbidden":
      return "Athlete not authorized for this account: the linked profile does not match the active athlete.";
    case "supabase_unconfigured":
      return "Supabase configuration missing on the server.";
    default:
      return code;
  }
}

export async function uploadHealthDocument(input: {
  athleteId: string;
  panelType: string;
  sampleDate: string;
  file: File;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  importStatus?: string;
  stagingRunId?: string | null;
  reviewUrl?: string | null;
}> {
  const form = new FormData();
  form.set("athleteId", input.athleteId);
  form.set("panelType", input.panelType);
  form.set("sampleDate", input.sampleDate);
  form.set("file", input.file);

  const headers = await buildSupabaseAuthHeaders();
  headers.delete("Content-Type");

  const res = await fetch("/api/health/upload-document", {
    method: "POST",
    body: form,
    headers,
  });
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    importStatus?: string;
    stagingRunId?: string | null;
    reviewUrl?: string | null;
  };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Upload failed" };
  }
  return {
    ok: true,
    message: json.message,
    importStatus: json.importStatus,
    stagingRunId: json.stagingRunId ?? null,
    reviewUrl: json.reviewUrl ?? null,
  };
}

export type HealthSystemMapViewModel = {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  bioenergeticsResponses: Array<Record<string, unknown>>;
  stagingRuns: Array<Record<string, unknown>>;
};

export type HealthStagingRunAction = "committed" | "rejected" | "archived";

/**
 * Mappa di sistema (nodi/archi + risposte bioenergetiche + staging run): assembla
 * più letture dirette da Supabase in parallelo (RLS come guardia, filtri espliciti
 * su `athlete_id` come nella vecchia route). Le tabelle opzionali non ancora
 * migrate vengono trattate come liste vuote.
 */
export async function fetchHealthSystemMap(athleteId: string): Promise<{
  systemMap: HealthSystemMapViewModel;
  error: string | null;
}> {
  const emptyMap: HealthSystemMapViewModel = { nodes: [], edges: [], bioenergeticsResponses: [], stagingRuns: [] };
  const trimmedAthleteId = athleteId.trim();
  if (!trimmedAthleteId) {
    return { systemMap: emptyMap, error: "missing_athleteId" };
  }

  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    return { systemMap: emptyMap, error: "System map not available" };
  }

  const [nodesRes, edgesRes, responsesRes, stagingRes] = await Promise.all([
    sb
      .from("athlete_system_nodes")
      .select("id, node_key, area, label, state, observed_at, created_at")
      .eq("athlete_id", trimmedAthleteId)
      .order("observed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("athlete_system_edges")
      .select("id, from_node_key, to_node_key, effect_sign, confidence, evidence_refs, rule_key, rule_version, time_window, metadata, observed_at, created_at")
      .eq("athlete_id", trimmedAthleteId)
      .order("observed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(260),
    sb
      .from("bioenergetics_responses")
      .select("id, response_key, category, title, description, trigger_refs, mitigation_refs, severity, confidence, observed_at, created_at")
      .eq("athlete_id", trimmedAthleteId)
      .order("observed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(120),
    sb
      .from("interpretation_staging_runs")
      .select("id, domain, status, confidence, created_at, source_refs")
      .eq("athlete_id", trimmedAthleteId)
      .in("domain", ["health", "physiology", "bioenergetics", "cross_module"])
      .in("status", ["ready", "pending_validation", "draft"])
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  try {
    const handleOptional = (res: { data: unknown; error: { message?: string; code?: string } | null }) => {
      if (!res.error) return (res.data ?? []) as Array<Record<string, unknown>>;
      if (isMissingRelationError(res.error)) return [];
      throw new Error(res.error.message || "health_system_map_error");
    };

    return {
      systemMap: {
        nodes: handleOptional(nodesRes),
        edges: handleOptional(edgesRes),
        bioenergeticsResponses: handleOptional(responsesRes),
        stagingRuns: handleOptional(stagingRes),
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "health_system_map_error";
    return { systemMap: emptyMap, error: message };
  }
}

export async function patchHealthStagingRun(input: {
  runId: string;
  status: HealthStagingRunAction;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/staging-runs/${encodeURIComponent(input.runId)}`, {
    method: "PATCH",
    cache: "no-store",
    headers,
    body: JSON.stringify({ status: input.status, reason: input.reason }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Staging update failed" };
  }
  return { ok: true };
}

export type HealthStagingRunDetail = {
  id: string;
  athleteId: string;
  domain: string;
  status: string;
  triggerSource: string | null;
  candidateBundle: Record<string, unknown> | null;
  proposedPatches: Array<Record<string, unknown>>;
  confidence: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type HealthStagingPanelSnapshot = {
  id: string;
  type: string;
  sampleDate: string | null;
  source: string | null;
  values: Record<string, unknown> | null;
  createdAt: string | null;
};

export async function fetchHealthStagingRunDetail(runId: string): Promise<{
  ok: boolean;
  run: HealthStagingRunDetail | null;
  panel: HealthStagingPanelSnapshot | null;
  signedUrl: string | null;
  importBlock: Record<string, unknown> | null;
  error?: string;
}> {
  const headers = await buildSupabaseAuthHeaders();
  let res = await fetch(`/api/health/staging-runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  let json = (await res.json()) as
    | {
        ok: true;
        run: Record<string, unknown>;
        panel: Record<string, unknown> | null;
        signedUrl: string | null;
        importBlock: Record<string, unknown> | null;
      }
    | { ok: false; error?: string };
  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch(`/api/health/staging-runs/${encodeURIComponent(runId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    json = (await res.json()) as typeof json;
  }
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      run: null,
      panel: null,
      signedUrl: null,
      importBlock: null,
      error: ("error" in json && json.error) || "Review not available",
    };
  }
  const r = json.run as Record<string, unknown>;
  const p = json.panel as Record<string, unknown> | null;
  const detail: HealthStagingRunDetail = {
    id: String(r.id ?? ""),
    athleteId: String(r.athlete_id ?? ""),
    domain: String(r.domain ?? ""),
    status: String(r.status ?? ""),
    triggerSource: typeof r.trigger_source === "string" ? r.trigger_source : null,
    candidateBundle:
      r.candidate_bundle && typeof r.candidate_bundle === "object" && !Array.isArray(r.candidate_bundle)
        ? (r.candidate_bundle as Record<string, unknown>)
        : null,
    proposedPatches: Array.isArray(r.proposed_structured_patches)
      ? (r.proposed_structured_patches as Array<Record<string, unknown>>)
      : [],
    confidence: typeof r.confidence === "number" ? r.confidence : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
  };
  const panel: HealthStagingPanelSnapshot | null = p
    ? {
        id: String(p.id ?? ""),
        type: String(p.type ?? ""),
        sampleDate: typeof p.sample_date === "string" ? p.sample_date : null,
        source: typeof p.source === "string" ? p.source : null,
        values:
          p.values && typeof p.values === "object" && !Array.isArray(p.values)
            ? (p.values as Record<string, unknown>)
            : null,
        createdAt: typeof p.created_at === "string" ? p.created_at : null,
      }
    : null;
  return {
    ok: true,
    run: detail,
    panel,
    signedUrl: json.signedUrl ?? null,
    importBlock: json.importBlock ?? null,
  };
}

export type HealthStagingApplyPatch = {
  field: string;
  value: number | string | null;
  unit?: string | null;
  confidence?: number;
};

export async function analyzePanelWithAi(input: {
  panelId: string;
  athleteId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  reviewUrl?: string | null;
  stagingRunId?: string | null;
  fieldCount?: number;
}> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/panels/${encodeURIComponent(input.panelId)}/analyze-with-ai`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({ athleteId: input.athleteId }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    note?: string;
    message?: string;
    reviewUrl?: string | null;
    stagingRunId?: string | null;
    fieldCount?: number;
  };
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      error: json.note ? `${json.error ?? ""}: ${json.note}` : json.error || "AI analysis failed",
    };
  }
  return {
    ok: true,
    message: json.message,
    reviewUrl: json.reviewUrl ?? null,
    stagingRunId: json.stagingRunId ?? null,
    fieldCount: json.fieldCount,
  };
}

export async function bulkReanalyzePanelsWithAi(input: {
  athleteId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  analyzed?: number;
  candidates?: number;
  withVlmProposals?: number;
  withParsedValues?: number;
  failed?: number;
  canonicalSkipped?: number;
}> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/panels/reanalyze-bulk`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({ athleteId: input.athleteId }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    analyzed?: number;
    candidates?: number;
    withVlmProposals?: number;
    withParsedValues?: number;
    failed?: number;
    canonicalSkipped?: number;
  };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Bulk re-analyze failed" };
  }
  return {
    ok: true,
    message: json.message,
    analyzed: json.analyzed,
    candidates: json.candidates,
    withVlmProposals: json.withVlmProposals,
    withParsedValues: json.withParsedValues,
    failed: json.failed,
    canonicalSkipped: json.canonicalSkipped,
  };
}

export async function applyHealthStagingPatches(input: {
  runId: string;
  confirmedPatches: HealthStagingApplyPatch[];
  reason?: string;
}): Promise<{ ok: boolean; error?: string; confirmedCount?: number }> {
  const headers = await buildSupabaseAuthHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/health/staging-runs/${encodeURIComponent(input.runId)}/apply`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({
      confirmedPatches: input.confirmedPatches,
      reason: input.reason ?? null,
    }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string; confirmedCount?: number };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "Confirmation failed" };
  }
  return { ok: true, confirmedCount: json.confirmedCount };
}
