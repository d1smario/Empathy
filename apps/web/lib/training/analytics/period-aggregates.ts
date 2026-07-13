import type { ExecutedWorkout } from "@empathy/domain-training";
import {
  monthPeakMetricProfile,
  normalizeDateKey,
  pickMetric,
  pickSeries,
  POWER_PROFILE_WINDOWS,
  type PowerProfileWindow,
  traceRecord,
} from "@/lib/training/calendar-analyzer-helpers";

export type PeriodGranularity = "week" | "month";

/** Finestre peak power mostrate in tabella (sottoinsieme del profilo potenza). */
export const PERIOD_PEAK_WINDOW_KEYS = ["w5s", "w1m", "w5m", "w20m", "w60m"] as const;
export const PERIOD_PEAK_WINDOWS: PowerProfileWindow[] = POWER_PROFILE_WINDOWS.filter((w) =>
  (PERIOD_PEAK_WINDOW_KEYS as readonly string[]).includes(w.key),
);

const HR_SERIES_KEYS = [
  "hr_series_bpm",
  "heart_rate_series_bpm",
  "heart_rate_series",
  "hr_stream_bpm",
  "hr_series",
];
const POWER_SERIES_KEYS = ["power_series_w", "power_stream_w", "power_series"];
const ELEV_GAIN_KEYS = [
  "elevation_gain_m",
  "ascent_m",
  "total_ascent_m",
  "total_ascent",
  "elevation_gain",
  "elev_gain_m",
];
const DISTANCE_KM_KEYS = ["distance_km", "total_distance_km", "distanceKm"];
const DISTANCE_M_KEYS = ["distance_m", "total_distance_m"];

export const HR_ZONE_LABELS = ["Z1", "Z2", "Z3", "Z4", "Z5"] as const;

function num(v: unknown): number | null {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Indice zona FC (0..4) da soglia LTHR (Coggan) o, in mancanza, da FCmax. */
function hrZoneIndex(bpm: number, lthr: number | null, hrMax: number | null): number {
  if (lthr && lthr > 0) {
    const p = bpm / lthr;
    if (p < 0.81) return 0;
    if (p < 0.9) return 1;
    if (p < 0.94) return 2;
    if (p < 1.0) return 3;
    return 4;
  }
  if (hrMax && hrMax > 0) {
    const p = bpm / hrMax;
    if (p < 0.6) return 0;
    if (p < 0.7) return 1;
    if (p < 0.8) return 2;
    if (p < 0.9) return 3;
    return 4;
  }
  return 0;
}

/** Calcolo ISO-week (lun=inizio). Ritorna {year, week} + lunedì della settimana. */
function isoWeek(d: Date): { year: number; week: number; monday: Date } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // lun=0
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - dayNum);
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // giovedì della settimana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: date.getUTCFullYear(), week, monday };
}

function periodKeyAndLabel(
  dateKey: string,
  granularity: PeriodGranularity,
): { key: string; label: string; start: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, day] = dateKey.split("-").map((s) => Number(s));
  const d = new Date(y!, (m ?? 1) - 1, day ?? 1);
  if (Number.isNaN(d.getTime())) return null;
  if (granularity === "month") {
    const mm = String(m).padStart(2, "0");
    return { key: `${y}-${mm}`, label: `${mm}/${y}`, start: `${y}-${mm}-01` };
  }
  const { year, week, monday } = isoWeek(d);
  const wk = String(week).padStart(2, "0");
  const startIso = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
  return { key: `${year}-W${wk}`, label: `S${week} '${String(year).slice(2)}`, start: startIso };
}

export type PeriodAggregateRow = {
  key: string;
  label: string;
  start: string;
  workoutCount: number;
  durationMin: number;
  distanceKm: number;
  tss: number;
  /** watts per finestra (key PERIOD_PEAK_WINDOW_KEYS) — null se nessun workout con potenza. */
  peak: Record<string, number | null>;
  /** minuti in ciascuna zona FC [Z1..Z5]. */
  hrZoneMin: number[];
  /** dislivello medio (m) sui workout del periodo che lo riportano; null se nessuno. */
  elevGainAvgM: number | null;
  /** true se almeno un workout del periodo ha serie potenza / FC. */
  hasPower: boolean;
  hasHr: boolean;
};

function distanceKmForWorkout(w: ExecutedWorkout, trace: Record<string, unknown> | null): number {
  const km = pickMetric(trace, DISTANCE_KM_KEYS);
  if (km != null) return km;
  const m = pickMetric(trace, DISTANCE_M_KEYS);
  if (m != null) return m / 1000;
  return 0;
}

/**
 * Aggregati per periodo (settimana ISO o mese) su un insieme di workout eseguiti —
 * come la «Legacy Dashboard» di TrainingPeaks: peak power 5s/1'/5'/20'/60', minuti in
 * zona FC, dislivello medio. Tutto client-side dai `trace_summary` già nel payload.
 */
export function buildPeriodAggregates(
  workouts: ExecutedWorkout[],
  opts: { granularity: PeriodGranularity; lthrBpm?: number | null; hrMaxBpm?: number | null },
): PeriodAggregateRow[] {
  const lthr = opts.lthrBpm ?? null;
  const hrMax = opts.hrMaxBpm ?? null;

  const groups = new Map<string, { meta: { key: string; label: string; start: string }; list: ExecutedWorkout[] }>();
  for (const w of workouts) {
    const dateKey = normalizeDateKey(w.date as string);
    const pk = periodKeyAndLabel(dateKey, opts.granularity);
    if (!pk) continue;
    const g = groups.get(pk.key) ?? { meta: pk, list: [] };
    g.list.push(w);
    groups.set(pk.key, g);
  }

  const rows: PeriodAggregateRow[] = [];
  for (const { meta, list } of groups.values()) {
    let durationMin = 0;
    let distanceKm = 0;
    let tss = 0;
    const hrZoneMin = [0, 0, 0, 0, 0];
    let elevSum = 0;
    let elevCount = 0;
    let hasPower = false;
    let hasHr = false;

    for (const w of list) {
      const trace = traceRecord(w);
      const durMin = num(w.durationMinutes) ?? 0;
      durationMin += durMin;
      distanceKm += distanceKmForWorkout(w, trace);
      tss += num(w.tss) ?? 0;

      const elev = pickMetric(trace, ELEV_GAIN_KEYS);
      if (elev != null && elev >= 0) {
        elevSum += elev;
        elevCount += 1;
      }

      const power = pickSeries(trace, POWER_SERIES_KEYS);
      if (power.length >= 2) hasPower = true;

      const hr = pickSeries(trace, HR_SERIES_KEYS);
      if (hr.length >= 2 && durMin > 0) {
        hasHr = true;
        // Campioni equi-spaziati → ogni campione = durMin/N minuti.
        const perSampleMin = durMin / hr.length;
        for (const bpm of hr) {
          if (!Number.isFinite(bpm) || bpm <= 0) continue;
          hrZoneMin[hrZoneIndex(bpm, lthr, hrMax)] += perSampleMin;
        }
      }
    }

    const peakMap = monthPeakMetricProfile(list, POWER_SERIES_KEYS, PERIOD_PEAK_WINDOWS);
    const peak: Record<string, number | null> = {};
    for (const wnd of PERIOD_PEAK_WINDOWS) {
      const v = peakMap.get(wnd.key) ?? 0;
      peak[wnd.key] = v > 0 ? Math.round(v) : null;
    }

    rows.push({
      key: meta.key,
      label: meta.label,
      start: meta.start,
      workoutCount: list.length,
      durationMin: Math.round(durationMin),
      distanceKm: Math.round(distanceKm),
      tss: Math.round(tss),
      peak,
      hrZoneMin: hrZoneMin.map((m) => Math.round(m)),
      elevGainAvgM: elevCount > 0 ? Math.round(elevSum / elevCount) : null,
      hasPower,
      hasHr,
    });
  }

  // Più recenti in cima.
  rows.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
  return rows;
}
