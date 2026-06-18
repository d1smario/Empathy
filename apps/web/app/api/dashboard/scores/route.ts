import { NextRequest, NextResponse } from "next/server";
import { physiologicalProfileFromDbRow, type PhysiologicalProfileDbRow } from "@empathy/domain-physiology";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import { resolveLatestRecoverySummary, buildRecoverySummaryFromRows, type RecoverySummary } from "@/lib/reality/recovery-summary";
import { resolveEpiForDate } from "@/lib/epi/epi-resolver";
import { extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";
import {
  composeDashboardScores,
  type BiomarkerPanelInput,
  type DashboardAreaKey,
  type DashboardScoresInput,
  type DashboardScoresPayload,
  type DashboardSnapshotTrends,
} from "@/lib/dashboard/dashboard-scores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const PHYS_SELECT =
  "id, athlete_id, ftp_watts, cp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, v_lamax, vo2max_ml_min_kg, economy, baseline_hrv_ms, valid_from, valid_to, updated_at";

type ProfileRow = {
  weight_kg?: number | string | null;
  body_fat_pct?: number | string | null;
  birth_date?: string | null;
} | null;
type PanelRow = { type?: string | null; sample_date?: string | null; created_at?: string | null; values?: Record<string, unknown> | null };
type DeviceExportRow = Record<string, unknown>;

/** All 9 dashboard areas, used to build the snapshot row + per-area trends. */
const AREA_KEYS: DashboardAreaKey[] = [
  "performance",
  "recovery",
  "sleep",
  "stress",
  "biomarkers",
  "hormones",
  "microbiome",
  "nutrition",
  "longevity",
];

/** One stored daily snapshot row (today + the 9 area columns). */
type DailyScoreRow = {
  date?: string | null;
  readiness?: number | null;
  system_status?: number | null;
} & Partial<Record<DashboardAreaKey, number | null>>;

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, delta: number): string {
  const base = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

/** Chronological age in years (1 decimal) from birth_date; null if missing/invalid. */
function chronologicalAge(birthDate: string | null | undefined, asOfIso: string): number | null {
  if (typeof birthDate !== "string" || birthDate.trim() === "") return null;
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00.000Z`);
  const asOf = new Date(`${asOfIso}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) return null;
  const years = (asOf.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(years) || years < 0) return null;
  return Math.round(years * 10) / 10;
}

/** Latest panel per normalized `type` (rows assumed newest-first). Keeps the row WITH values. */
function indexLatestPanelsByType(rows: PanelRow[]): Partial<Record<string, BiomarkerPanelInput>> {
  const byType: Partial<Record<string, BiomarkerPanelInput>> = {};
  for (const row of rows) {
    const type = typeof row.type === "string" ? row.type.trim().toLowerCase() : "";
    if (!type) continue;
    if (byType[type]) continue; // already have the newest for this type
    byType[type] = {
      type,
      sample_date: typeof row.sample_date === "string" ? row.sample_date : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      values: row.values && typeof row.values === "object" ? row.values : null,
    };
  }
  return byType;
}

/**
 * Build a 7-day recovery series (oldest→newest) by grouping device exports per logical day and
 * reusing `buildRecoverySummaryFromRows` for each day. No new physiology — same extractor/composer.
 */
function buildRecoverySeries7d(rows: DeviceExportRow[], endIso: string): RecoverySummary[] {
  const startIso = addDays(endIso, -6);
  const byDay = new Map<string, DeviceExportRow[]>();
  for (const row of rows) {
    const signal = extractSignalFromDeviceExportRow(row);
    const day =
      (typeof signal.sourceDate === "string" && signal.sourceDate.slice(0, 10)) ||
      (typeof row.created_at === "string" ? row.created_at.slice(0, 10) : null);
    if (!day || day < startIso || day > endIso) continue;
    const bucket = byDay.get(day) ?? [];
    bucket.push(row);
    byDay.set(day, bucket);
  }
  const series: RecoverySummary[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = addDays(endIso, -i);
    const dayRows = byDay.get(day);
    if (!dayRows || !dayRows.length) continue;
    const summary = buildRecoverySummaryFromRows(dayRows);
    if (summary) series.push(summary);
  }
  return series;
}

/** Today's scores as an integer-or-null snapshot row (null where the area has no data). */
function snapshotRowFromPayload(athleteId: string, dateIso: string, today: DashboardScoresPayload): DailyScoreRow & {
  athlete_id: string;
} {
  const intOrNull = (v: number | null | undefined): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
  const byKey = new Map<DashboardAreaKey, number | null>();
  for (const area of today.areas) byKey.set(area.key, area.hasData ? intOrNull(area.score) : null);
  const row: DailyScoreRow & { athlete_id: string } = {
    athlete_id: athleteId,
    date: dateIso,
    readiness: intOrNull(today.readiness.score),
    system_status: intOrNull(today.systemStatus.pct),
  };
  for (const key of AREA_KEYS) row[key] = byKey.get(key) ?? null;
  return row;
}

/**
 * Persist today's snapshot and reconstruct 30-day chronological trends from
 * `dashboard_daily_scores`. Entirely best-effort: if the admin client is missing,
 * the table does not exist, or any query errors, returns `null` so the composer
 * falls back to the in-memory device/twin series. Never throws, never fakes data.
 */
async function persistAndReadSnapshotTrends(
  athleteId: string,
  dateIso: string,
  today: DashboardScoresPayload,
): Promise<DashboardSnapshotTrends | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  // UPSERT today (silent on failure — e.g. table not migrated yet).
  try {
    const row = snapshotRowFromPayload(athleteId, dateIso, today);
    await admin.from("dashboard_daily_scores").upsert(row, { onConflict: "athlete_id,date" });
  } catch {
    /* swallow: dashboard must not break if snapshots are unavailable */
  }

  // READ the last ~30 snapshots (oldest→newest) and build per-area trends.
  try {
    const since = addDays(dateIso, -29);
    const { data, error } = await admin
      .from("dashboard_daily_scores")
      .select("date, readiness, system_status, performance, recovery, sleep, stress, biomarkers, hormones, microbiome, nutrition, longevity")
      .eq("athlete_id", athleteId)
      .gte("date", since)
      .lte("date", dateIso)
      .order("date", { ascending: true })
      .limit(31);
    if (error || !data || !data.length) return null;

    const rows = data as DailyScoreRow[];
    const numericSeries = (pick: (r: DailyScoreRow) => number | null | undefined): number[] =>
      rows
        .map((r) => pick(r))
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    const areas: Partial<Record<DashboardAreaKey, number[]>> = {};
    for (const key of AREA_KEYS) {
      const series = numericSeries((r) => r[key]);
      if (series.length) areas[key] = series;
    }
    const readiness = numericSeries((r) => r.readiness);
    const systemStatus = numericSeries((r) => r.system_status);

    const trends: DashboardSnapshotTrends = {};
    if (readiness.length) trends.readiness = readiness;
    if (systemStatus.length) trends.systemStatus = systemStatus;
    if (Object.keys(areas).length) trends.areas = areas;
    return Object.keys(trends).length ? trends : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/dashboard/scores?athleteId=...&date=YYYY-MM-DD
 * 0–100 scores for the 9 dashboard areas + readiness + system status + physiological KPIs.
 * Reuses the canonical resolvers (twin / recovery / EPI / health panels) — no invented physiology.
 */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const generatedAt = (req.nextUrl.searchParams.get("generatedAt") ?? "").trim() || undefined;
    const date = (req.nextUrl.searchParams.get("date") ?? "").trim() || undefined;
    const end = todayIso();
    const recoveryFrom = addDays(end, -7);

    const { db } = await requireAthleteReadContext(req, athleteId);

    const [profRes, physRes, panelsRes, deviceRes, twin, recovery, resolvedEpi] = await Promise.all([
      db.from("athlete_profiles").select("weight_kg, body_fat_pct, birth_date").eq("id", athleteId).maybeSingle(),
      db
        .from("physiological_profiles")
        .select(PHYS_SELECT)
        .eq("athlete_id", athleteId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("biomarker_panels")
        .select("type, sample_date, created_at, values")
        .eq("athlete_id", athleteId)
        .order("sample_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("device_sync_exports")
        .select("provider, payload, created_at")
        .eq("athlete_id", athleteId)
        .gte("created_at", `${recoveryFrom}T00:00:00.000Z`)
        .order("created_at", { ascending: false })
        .limit(64),
      resolveCanonicalTwinState(athleteId).catch(() => null),
      resolveLatestRecoverySummary(athleteId).catch(() => null),
      resolveEpiForDate(athleteId, date).catch(() => null),
    ]);

    const errMsg =
      profRes.error?.message ?? physRes.error?.message ?? panelsRes.error?.message ?? deviceRes.error?.message ?? null;
    if (errMsg) {
      return NextResponse.json({ ok: false as const, error: errMsg }, { status: 500, headers: NO_STORE });
    }

    const profileRow = (profRes.data ?? null) as ProfileRow;
    const profile = profileRow
      ? { weightKg: asNum(profileRow.weight_kg), bodyFatPct: asNum(profileRow.body_fat_pct) }
      : null;
    // Target = età anagrafica (riferimento dell'età biologica) da athlete_profiles.birth_date.
    const targetAge = chronologicalAge(profileRow?.birth_date, end);

    const physRow = (physRes.data ?? null) as PhysiologicalProfileDbRow | null;
    const physiology = physRow ? physiologicalProfileFromDbRow(physRow) : null;

    const panelsByType = indexLatestPanelsByType((panelsRes.data ?? []) as PanelRow[]);
    const recoverySeries7d = buildRecoverySeries7d((deviceRes.data ?? []) as DeviceExportRow[], end);

    const baseInput: DashboardScoresInput = {
      athleteId,
      generatedAt,
      twin,
      recovery,
      twinHistory7d: twin?.history,
      recoverySeries7d,
      internalLoadIndexSeries7d: [],
      epi: resolvedEpi?.epi ?? null,
      physiology,
      profile,
      targetAge,
      panelsByType,
    };

    // Compose today's scores first; they seed the snapshot upsert below.
    const today = composeDashboardScores(baseInput);

    // ---- Snapshot trend (robust if `dashboard_daily_scores` does not exist yet) ----
    // UPSERT today's row (service role) then read the last ~30 days for chronological trends.
    // Any failure here (missing table, RLS, etc.) is swallowed: the dashboard never breaks.
    const snapshotTrends = await persistAndReadSnapshotTrends(athleteId, end, today);

    const payload = snapshotTrends
      ? composeDashboardScores({ ...baseInput, snapshotTrends })
      : today;
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "dashboard_scores_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
