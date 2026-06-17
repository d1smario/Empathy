import { NextRequest, NextResponse } from "next/server";
import { physiologicalProfileFromDbRow, type PhysiologicalProfileDbRow } from "@empathy/domain-physiology";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveCanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import { resolveLatestRecoverySummary, buildRecoverySummaryFromRows, type RecoverySummary } from "@/lib/reality/recovery-summary";
import { resolveEpiForDate } from "@/lib/epi/epi-resolver";
import { extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";
import {
  composeDashboardScores,
  type BiomarkerPanelInput,
  type DashboardScoresInput,
} from "@/lib/dashboard/dashboard-scores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const PHYS_SELECT =
  "id, athlete_id, ftp_watts, cp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, v_lamax, vo2max_ml_min_kg, economy, baseline_hrv_ms, valid_from, valid_to, updated_at";

type ProfileRow = { weight_kg?: number | string | null; body_fat_pct?: number | string | null } | null;
type PanelRow = { type?: string | null; sample_date?: string | null; created_at?: string | null; values?: Record<string, unknown> | null };
type DeviceExportRow = Record<string, unknown>;

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
      db.from("athlete_profiles").select("weight_kg, body_fat_pct").eq("id", athleteId).maybeSingle(),
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

    const physRow = (physRes.data ?? null) as PhysiologicalProfileDbRow | null;
    const physiology = physRow ? physiologicalProfileFromDbRow(physRow) : null;

    const panelsByType = indexLatestPanelsByType((panelsRes.data ?? []) as PanelRow[]);
    const recoverySeries7d = buildRecoverySeries7d((deviceRes.data ?? []) as DeviceExportRow[], end);

    const input: DashboardScoresInput = {
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
      panelsByType,
    };

    const payload = composeDashboardScores(input);
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "dashboard_scores_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
