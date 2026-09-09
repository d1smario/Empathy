/**
 * Punteggi dashboard di un atleta + istantanea giornaliera su `dashboard_daily_scores`.
 *
 * Estratto da `app/api/dashboard/scores/route.ts` perché la SCRITTURA del punto giornaliero
 * non deve più dipendere da una visita: la faceva la GET a ogni apertura di /analysis, quindi
 * il trend a 30 giorni esisteva solo per i giorni in cui qualcuno aveva aperto la pagina — e
 * se la apriva il coach, la riga veniva scritta per l'atleta guardato. Ora la scrive il cron
 * delle 05:00 per tutta la platea; la pagina si limita a LEGGERE.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { physiologicalProfileFromDbRow, type PhysiologicalProfileDbRow } from "@empathy/domain-physiology";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { asCanonicalTwinState, resolveCanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import { buildRecoverySummaryFromRows, resolveLatestRecoverySummary, type RecoverySummary } from "@/lib/reality/recovery-summary";
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

export const PHYS_SELECT =
  "id, athlete_id, ftp_watts, cp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, v_lamax, vo2max_ml_min_kg, economy, baseline_hrv_ms, valid_from, valid_to, updated_at";

type ProfileRow = {
  weight_kg?: number | string | null;
  body_fat_pct?: number | string | null;
  birth_date?: string | null;
} | null;
type PanelRow = { type?: string | null; sample_date?: string | null; created_at?: string | null; values?: Record<string, unknown> | null };
type DeviceExportRow = Record<string, unknown>;

/** Le 9 aree della dashboard: colonne della riga-istantanea e dei trend per area. */
export const AREA_KEYS: DashboardAreaKey[] = [
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

/** Una riga salvata (giorno + readiness + stato sistema + le 9 aree). */
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

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(isoDate: string, delta: number): string {
  const base = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

/** Età anagrafica in anni (1 decimale) da birth_date; null se manca o non è valida. */
function chronologicalAge(birthDate: string | null | undefined, asOfIso: string): number | null {
  if (typeof birthDate !== "string" || birthDate.trim() === "") return null;
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00.000Z`);
  const asOf = new Date(`${asOfIso}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) return null;
  const years = (asOf.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(years) || years < 0) return null;
  return Math.round(years * 10) / 10;
}

/** Ultimo pannello per `type` normalizzato (righe attese dalla più recente). Tiene quella CON i valori. */
function indexLatestPanelsByType(rows: PanelRow[]): Partial<Record<string, BiomarkerPanelInput>> {
  const byType: Partial<Record<string, BiomarkerPanelInput>> = {};
  for (const row of rows) {
    const type = typeof row.type === "string" ? row.type.trim().toLowerCase() : "";
    if (!type) continue;
    if (byType[type]) continue; // già presa la più recente per questo tipo
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
 * Serie di recupero a 7 giorni (dal più vecchio al più recente): raggruppa gli export device per
 * giorno logico e riusa `buildRecoverySummaryFromRows`. Nessuna fisiologia nuova.
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

export type DashboardScoresBuild =
  | { ok: true; today: DashboardScoresPayload; baseInput: DashboardScoresInput }
  | { ok: false; error: string };

/**
 * Compone i punteggi di oggi per un atleta. Non scrive nulla: la persistenza è separata,
 * così la stessa funzione serve sia la pagina (lettura) sia il cron (scrittura).
 */
export async function buildDashboardScoresForAthlete(
  db: SupabaseClient,
  athleteId: string,
  opts?: { generatedAt?: string; date?: string; endIso?: string },
): Promise<DashboardScoresBuild> {
  const end = opts?.endIso ?? todayIso();
  const recoveryFrom = addDays(end, -7);

  const [profRes, physRes, panelsRes, deviceRes, memory, recovery] = await Promise.all([
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
    // Spina canonica al posto del twin diretto: la memory-slice risolve twin (+ IL +
    // physiology) UNA volta e resta in cache in-process — l'EPI subito sotto, che
    // risolve la STESSA slice, la trova in cache.
    resolveAthleteMemorySlice(athleteId, { slice: "bioenergetics" }).catch(() => null),
    resolveLatestRecoverySummary(athleteId).catch(() => null),
  ]);

  const twin =
    asCanonicalTwinState(memory?.twin) ?? (await resolveCanonicalTwinState(athleteId).catch(() => null));

  const resolvedEpi = await resolveEpiForDate(athleteId, opts?.date, {
    internalLoadState: twin?.internalLoadState,
  }).catch(() => null);

  const errMsg =
    profRes.error?.message ?? physRes.error?.message ?? panelsRes.error?.message ?? deviceRes.error?.message ?? null;
  if (errMsg) return { ok: false, error: errMsg };

  const profileRow = (profRes.data ?? null) as ProfileRow;
  const profile = profileRow
    ? { weightKg: asNum(profileRow.weight_kg), bodyFatPct: asNum(profileRow.body_fat_pct) }
    : null;
  const targetAge = chronologicalAge(profileRow?.birth_date, end);

  const physRow = (physRes.data ?? null) as PhysiologicalProfileDbRow | null;
  const physiology = physRow ? physiologicalProfileFromDbRow(physRow) : null;

  const panelsByType = indexLatestPanelsByType((panelsRes.data ?? []) as PanelRow[]);
  const recoverySeries7d = buildRecoverySeries7d((deviceRes.data ?? []) as DeviceExportRow[], end);

  const baseInput: DashboardScoresInput = {
    athleteId,
    generatedAt: opts?.generatedAt,
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

  return { ok: true, today: composeDashboardScores(baseInput), baseInput };
}

/** I punteggi di oggi come riga intera-o-null (null dove l'area non ha dati). */
function snapshotRowFromPayload(
  athleteId: string,
  dateIso: string,
  today: DashboardScoresPayload,
): DailyScoreRow & { athlete_id: string } {
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
 * Scrive la riga del giorno. Chiamata SOLO dal cron: la pagina non scrive più.
 * Best-effort come la lettura — se la tabella non c'è, non deve rompere il cron.
 */
export async function persistDailyScoreSnapshot(
  admin: SupabaseClient,
  athleteId: string,
  dateIso: string,
  today: DashboardScoresPayload,
): Promise<boolean> {
  try {
    const row = snapshotRowFromPayload(athleteId, dateIso, today);
    const { error } = await admin.from("dashboard_daily_scores").upsert(row, { onConflict: "athlete_id,date" });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Legge le ultime ~30 istantanee (dalla più vecchia) e costruisce i trend per area.
 * Best-effort: se il client admin manca, la tabella non esiste o una query fallisce,
 * torna `null` e il compositore ricade sulle serie in memoria. Non lancia mai.
 */
export async function readSnapshotTrends(
  admin: SupabaseClient | null,
  athleteId: string,
  dateIso: string,
): Promise<DashboardSnapshotTrends | null> {
  if (!admin) return null;
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
      rows.map((r) => pick(r)).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

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
