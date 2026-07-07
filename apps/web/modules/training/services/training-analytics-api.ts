import type { TrainingAnalyticsViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

/**
 * Endpoint analytics pesante (aggrega serie, finestre, rollup, loop adattamento, twin,
 * memoria…): a caldo risponde in ~2s, ma il PRIMO hit può essere lento (compile route in
 * dev / finestra 365D / rete). Timeout generoso + 1 retry su timeout: al 2° tentativo la
 * route è calda e risponde subito, invece di mostrare all'utente un falso «nessun dato».
 */
const ANALYTICS_TIMEOUT_MS = 25000;

function emptyTrainingAnalyticsVM(error: string): TrainingAnalyticsViewModel {
  return {
    rows: [],
    executedSessions: [],
    plannedRows: [],
    series: [],
    compareSeries: [],
    latest: null,
    windows: null,
    planWindows: null,
    executedVolumeRollup: null,
    recoveryContinuousRollup: null,
    adaptationLoop: null,
    adaptationSummary: null,
    twinState: null,
    athleteMemory: null,
    recoverySummary: null,
    operationalContext: null,
    bioenergeticModulation: null,
    adaptationGuidance: null,
    nutritionPerformanceIntegration: null,
    crossModuleDynamicsLines: [],
    readSpineCoverage: null,
    error,
  };
}

export async function fetchTrainingAnalyticsRows(input: {
  athleteId: string;
  from: string;
  to: string;
}): Promise<TrainingAnalyticsViewModel> {
  const url = `/api/training/analytics?${new URLSearchParams(input).toString()}`;
  const authHeaders = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });

  const attempt = async (): Promise<Response> => {
    let res = await fetchWithTimeout(
      url,
      { method: "GET", headers: authHeaders, cache: "no-store" },
      ANALYTICS_TIMEOUT_MS,
    );
    if (res.status === 401) {
      res = await fetchWithTimeout(
        url,
        { method: "GET", cache: "no-store", credentials: "same-origin" },
        ANALYTICS_TIMEOUT_MS,
      );
    }
    return res;
  };

  let response: Response;
  try {
    response = await attempt();
  } catch (error) {
    // Un solo retry, ma solo su timeout (il cold-start colpisce la 1ª richiesta).
    const isTimeout = error instanceof Error && /timed out/i.test(error.message);
    if (isTimeout) {
      try {
        response = await attempt();
      } catch (retryError) {
        return emptyTrainingAnalyticsVM(
          retryError instanceof Error ? retryError.message : "Training analytics fetch failed",
        );
      }
    } else {
      return emptyTrainingAnalyticsVM(error instanceof Error ? error.message : "Training analytics fetch failed");
    }
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return emptyTrainingAnalyticsVM(payload.error ?? "Training analytics fetch failed");
  }

  const payload = (await response.json()) as TrainingAnalyticsViewModel;
  return {
    rows: payload.rows ?? [],
    executedSessions: payload.executedSessions ?? [],
    plannedRows: payload.plannedRows ?? [],
    series: payload.series ?? [],
    compareSeries: payload.compareSeries ?? [],
    latest: payload.latest ?? null,
    windows: payload.windows ?? null,
    planWindows: payload.planWindows ?? null,
    executedVolumeRollup: payload.executedVolumeRollup ?? null,
    recoveryContinuousRollup: payload.recoveryContinuousRollup ?? null,
    adaptationLoop: payload.adaptationLoop ?? null,
    adaptationSummary: payload.adaptationSummary ?? null,
    twinState: payload.twinState ?? null,
    athleteMemory: payload.athleteMemory ?? null,
    recoverySummary: payload.recoverySummary ?? null,
    operationalContext: payload.operationalContext ?? null,
    bioenergeticModulation: payload.bioenergeticModulation ?? null,
    adaptationGuidance: payload.adaptationGuidance ?? null,
    nutritionPerformanceIntegration: payload.nutritionPerformanceIntegration ?? null,
    crossModuleDynamicsLines: payload.crossModuleDynamicsLines ?? [],
    readSpineCoverage: payload.readSpineCoverage ?? null,
    crossChannelSessions: payload.crossChannelSessions ?? [],
    trainingRealityDiagnostics: payload.trainingRealityDiagnostics ?? null,
    error: payload.error,
    athleteId: payload.athleteId,
    from: payload.from,
    to: payload.to,
  };
}
