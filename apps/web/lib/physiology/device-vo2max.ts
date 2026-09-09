/**
 * VO₂max MISURATO dall'orologio.
 *
 * Garmin manda `vo2Max` (corsa) e `vo2MaxCycling` nello stream `userMetrics`, insieme
 * all'età di fitness. Il dato arrivava e nessuno lo leggeva: la Fisiologia stimava il
 * VO₂max dalla curva di potenza digitata a mano mentre il valore dell'orologio stava
 * nel database. Qui lo estraiamo, con la sua data e la sua origine, perché un numero
 * misurato e uno derivato non vanno mostrati allo stesso modo.
 *
 * Nessuna invenzione: se il campo manca o è implausibile, torna `null`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DeviceVo2maxSport = "cycling" | "running";

export type DeviceVo2max = {
  /** ml/kg/min, come lo manda il dispositivo. */
  mlMinKg: number;
  sport: DeviceVo2maxSport;
  /** Giorno a cui il dispositivo riferisce la stima (`calendarDate`). */
  measuredOn: string | null;
  provider: "garmin";
  /** Garmin marca `enhanced` le stime del modello nuovo. Riportato, non interpretato. */
  enhanced: boolean;
  /** Età di fitness dichiarata dal dispositivo, quando c'è. */
  fitnessAge: number | null;
};

/**
 * Finestra di plausibilità. Sotto 20 non è un atleta che si allena, sopra 95 si esce dai
 * valori mai misurati in laboratorio: fuori da qui è un errore di unità o di parsing, non
 * un dato da mostrare.
 */
const MIN_ML_KG_MIN = 20;
const MAX_ML_KG_MIN = 95;

function plausible(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < MIN_ML_KG_MIN || n > MAX_ML_KG_MIN) return null;
  return n;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export type DeviceExportRowLike = { payload?: unknown; created_at?: unknown };

/**
 * Estrae il VO₂max più recente dalle righe date (attese dalla più recente).
 *
 * `preferSport` decide quale dei due valori vince quando ci sono entrambi: Empathy ragiona
 * in watt e curva di potenza, quindi il default è la bici.
 */
export function extractDeviceVo2maxFromRows(
  rows: DeviceExportRowLike[],
  opts?: { preferSport?: DeviceVo2maxSport },
): DeviceVo2max | null {
  const prefer = opts?.preferSport ?? "cycling";
  for (const row of rows) {
    const payload = asRecord(row?.payload);
    const source = asRecord(payload?.sourcePayload);
    if (!source) continue;
    if (source.garmin_wellness_stream !== "userMetrics") continue;

    const cycling = plausible(source.vo2MaxCycling);
    const running = plausible(source.vo2Max);
    const picked: { v: number; sport: DeviceVo2maxSport } | null =
      prefer === "cycling"
        ? cycling != null
          ? { v: cycling, sport: "cycling" }
          : running != null
            ? { v: running, sport: "running" }
            : null
        : running != null
          ? { v: running, sport: "running" }
          : cycling != null
            ? { v: cycling, sport: "cycling" }
            : null;
    if (!picked) continue;

    const calendarDate = typeof source.calendarDate === "string" ? source.calendarDate.slice(0, 10) : null;
    const createdAt = typeof row?.created_at === "string" ? row.created_at.slice(0, 10) : null;
    const fitnessAgeRaw = source.fitnessAge;
    const fitnessAge =
      typeof fitnessAgeRaw === "number" && Number.isFinite(fitnessAgeRaw) && fitnessAgeRaw > 0 ? fitnessAgeRaw : null;

    return {
      mlMinKg: picked.v,
      sport: picked.sport,
      measuredOn: calendarDate ?? createdAt,
      provider: "garmin",
      enhanced: source.enhanced === true,
      fitnessAge,
    };
  }
  return null;
}

/** Ultimo VO₂max misurato dall'orologio per un atleta, o `null` se non ne è mai arrivato uno. */
export async function loadLatestDeviceVo2max(
  db: SupabaseClient,
  athleteId: string,
  opts?: { preferSport?: DeviceVo2maxSport; lookbackDays?: number },
): Promise<DeviceVo2max | null> {
  const lookbackDays = opts?.lookbackDays ?? 180;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("device_sync_exports")
    .select("payload, created_at")
    .eq("athlete_id", athleteId)
    .eq("provider", "garmin")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error || !data) return null;
  return extractDeviceVo2maxFromRows(data as DeviceExportRowLike[], { preferSport: opts?.preferSport });
}
