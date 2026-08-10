import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

type LabSection = "metabolic_profile" | "lactate_analysis" | "max_oxidate";

export async function fetchPhysiologyHistoryAndFtp(athleteId: string) {
  const response = await fetchWithTimeout(`/api/physiology/history?athleteId=${encodeURIComponent(athleteId)}`, {
    method: "GET",
    // Dopo un ricalcolo/salvataggio la pagina deve rileggere dal DB, mai dalla cache HTTP del browser.
    cache: "no-store",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Fetch physiology history failed");
  }
  return (await response.json()) as {
    history: Array<Record<string, unknown>>;
    /** Ultimo run `metabolic_profile` per ripopolare la curva CP anche se non è nella finestra mista recente dell’API history. */
    latestMetabolicProfileRun?: Record<string, unknown> | null;
    latestLactateRun?: Record<string, unknown> | null;
    latestMaxOxRun?: Record<string, unknown> | null;
    ftpW: number | null;
    /** Peso atleta da `athlete_profiles.weight_kg` (null se assente / fuori range). */
    athleteWeightKg?: number | null;
    /** VO₂max come scritto sulla riga corrente di `physiological_profiles` (colonna, non valore canonico). */
    profileVo2maxMlMinKg?: number | null;
    profileVo2maxLMin?: number | null;
    /** VO₂max canonico del resolver (ultimo run `metabolic_profile` con precedenza sulla colonna): traccia di audit. */
    canonicalVo2maxMlMinKg?: number | null;
    canonicalVo2maxLMin?: number | null;
    autoInputs?: {
      source: string;
      /** Sedute davvero passate al decoder: al più `sessionsWindow` (finestra mobile). */
      sessionsAnalyzed: number;
      /** Ampiezza della finestra mobile letta da `executed_workouts`. */
      sessionsWindow?: number;
      /** Sedute totali dell'atleta; null/assente se il conteggio non è disponibile. */
      sessionsTotal?: number | null;
      lactate?: Record<string, number>;
      maxox?: Record<string, number>;
    };
    /** Glicemia allineata: pannello sangue Health → baseline profilo → media sessioni. */
    healthBioGlucose?: { mmol_l: number; source: "blood_panel" | "physiological_baseline" | "session_roll" } | null;
    /** Temperatura core da `physiological_profiles.baseline_temp_c` (°C). */
    healthBioCoreTempC?: number | null;
    microbiotaProfile?: {
      source: string;
      candida_overgrowth_pct: number;
      bifidobacteria_pct: number;
      akkermansia_pct: number;
      butyrate_producers_pct: number;
      endotoxin_risk_pct: number;
    } | null;
    workouts?: Array<{
      id: string;
      date: string;
      duration_min: number;
      tss: number;
      sport: string;
      power_w: number | null;
      velocity_m_min: number | null;
      grade_pct: number | null;
      elevation_gain_m: number | null;
      core_temp_c: number | null;
      skin_temp_c: number | null;
      rer: number | null;
      vo2_l_min: number | null;
      vco2_l_min: number | null;
      smo2: number | null;
      lactate_mmol_l: number | null;
      glucose_mmol_l: number | null;
    }>;
  };
}

export async function savePhysiologySnapshot(input: {
  athleteId: string;
  runSection: LabSection;
  modelVersion: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  createdBy: string | null;
  profileUpdate?: {
    ftp_watts: number;
    lt1_watts: number;
    lt2_watts: number;
    v_lamax: number;
    vo2max_ml_min_kg: number;
    cp_watts?: number;
  } | null;
}) {
  const response = await fetchWithTimeout("/api/physiology/snapshot", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Save physiology snapshot failed");
  }
}

