import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { type GeoPoint, isGeoPoint } from "@/lib/training/series-channel-registry";

/** Canali numerici del grafico letti da `executed_workout_series` (esclusi route/time_elapsed). */
const NUMERIC_CHART_CHANNELS = [
  "power",
  "hr",
  "speed",
  "cadence",
  "altitude",
  "temperature",
  "distance",
  "pace_min_per_km",
  "vertical_speed_mps",
] as const;

export type ExecutedSeriesBundle = { channel: string; unit: string; values: number[] };
export type ExecutedSeriesResult = {
  series: ExecutedSeriesBundle[];
  routePoints: GeoPoint[];
  /** Ultimo campione del canale `distance` (metri), se presente. */
  distanceMeters: number | null;
};

const EMPTY: ExecutedSeriesResult = { series: [], routePoints: [], distanceMeters: null };

/**
 * DB-first: legge le serie HD di una seduta eseguita da `executed_workout_series`
 * (RLS access-scoped). Condiviso tra il dettaglio seduta e l'anteprima riga calendario,
 * così la logica di parsing (route, distance, campioni numerici) è una sola.
 */
export async function fetchExecutedSeriesBundles(
  athleteId: string,
  workoutId: string,
  opts?: { includeRoute?: boolean },
): Promise<ExecutedSeriesResult> {
  const supabase = createEmpathyBrowserSupabase();
  if (!supabase) return EMPTY;
  const channels =
    opts?.includeRoute === false ? [...NUMERIC_CHART_CHANNELS] : [...NUMERIC_CHART_CHANNELS, "route"];
  const { data, error } = await supabase
    .from("executed_workout_series")
    .select("channel, unit, samples")
    .eq("athlete_id", athleteId)
    .eq("executed_workout_id", workoutId)
    .in("channel", channels);
  if (error || !data) return EMPTY;
  const rows = data as Array<{ channel: string; unit: string; samples: unknown }>;

  const series: ExecutedSeriesBundle[] = [];
  let routePoints: GeoPoint[] = [];
  let distanceMeters: number | null = null;

  for (const c of rows) {
    if (c.channel === "route") {
      const pts = (Array.isArray(c.samples) ? c.samples : []).filter(isGeoPoint) as GeoPoint[];
      if (pts.length > routePoints.length) routePoints = pts;
      continue;
    }
    const nums = Array.isArray(c.samples)
      ? (c.samples.filter((v) => typeof v === "number" && Number.isFinite(v)) as number[])
      : [];
    if (nums.length < 1) continue;
    if (c.channel === "distance") {
      const last = nums[nums.length - 1];
      if (typeof last === "number" && Number.isFinite(last)) distanceMeters = last;
    }
    // Recharts line/area: almeno 2 punti; con 1 campione (sessioni brevi) duplichiamo costante.
    const values = nums.length >= 2 ? nums : [nums[0]!, nums[0]!];
    series.push({ channel: c.channel, unit: c.unit, values });
  }

  return { series, routePoints, distanceMeters };
}
