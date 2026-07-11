import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";
import { loadObservedActiveKcal } from "@/lib/nutrition/load-observed-active-kcal";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";

/**
 * Fattore di correzione TDEE «imparato» dagli ultimi N giorni (ripianificazione settimanale).
 * Confronta, sui giorni con dato device, il consumo OSSERVATO col fabbisogno STIMATO dal
 * pianificato: se in media hai speso più del previsto → factor > 1 (la settimana prossima
 * targetta più alto), e viceversa. Clampato e conservativo; se pochi dati → 1.0 (neutro).
 */

const CLAMP_MIN = 0.9;
const CLAMP_MAX = 1.15;
const MIN_DAYS = 3;
const LOOKBACK_DAYS = 7;

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function addDaysUTC(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type WeeklyTdeeCorrection = { factor: number; daysUsed: number; note: string };

export async function computeWeeklyTdeeCorrection(
  db: SupabaseClient,
  athleteId: string,
  referenceDate: string,
): Promise<WeeklyTdeeCorrection> {
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("birth_date, sex, height_cm, weight_kg, body_fat_pct, ftp_watts, lifestyle_activity_class")
    .eq("id", athleteId)
    .maybeSingle();
  const p = (profile ?? {}) as Record<string, unknown>;

  const dates = Array.from({ length: LOOKBACK_DAYS }, (_, i) => addDaysUTC(referenceDate, -(i + 1)));
  const ratios: number[] = [];

  for (const day of dates) {
    const [{ data: plannedRows }, observedActiveKcal] = await Promise.all([
      db
        .from("planned_workouts")
        .select("duration_minutes, tss_target, kcal_target, notes")
        .eq("athlete_id", athleteId)
        .eq("date", day),
      loadObservedActiveKcal(db, athleteId, day),
    ]);
    if (observedActiveKcal == null) continue;

    const plannedTraining = (Array.isArray(plannedRows) ? plannedRows : []).map((r) => {
      const rr = r as Record<string, unknown>;
      const bs = parsePro2BuilderSessionFromNotes(typeof rr.notes === "string" ? rr.notes : null);
      return {
        durationMinutes: num(rr.duration_minutes) ?? 0,
        tssTarget: num(rr.tss_target) ?? undefined,
        kcalTarget: num(rr.kcal_target) ?? undefined,
        avgPowerW: bs?.summary?.avgPowerW ?? null,
      };
    });
    const estimated = computeNutritionDailyEnergyModel({
      athleteId,
      date: day,
      birthDate: typeof p.birth_date === "string" ? p.birth_date : null,
      sex: typeof p.sex === "string" ? p.sex : null,
      heightCm: num(p.height_cm),
      weightKg: num(p.weight_kg),
      bodyFatPct: num(p.body_fat_pct),
      ftpWatts: num(p.ftp_watts),
      vo2maxMlMinKg: null,
      lifestyleActivityClass: typeof p.lifestyle_activity_class === "string" ? p.lifestyle_activity_class : "moderate",
      plannedTraining,
      recoveryStatus: "unknown",
    });
    const observedTotal = estimated.bmrKcal + observedActiveKcal;
    const estimatedTotal = estimated.totals.dailyKcal;
    if (estimatedTotal > 0) ratios.push(observedTotal / estimatedTotal);
  }

  if (ratios.length < MIN_DAYS) {
    return { factor: 1, daysUsed: ratios.length, note: `Dati insufficienti (${ratios.length}/${MIN_DAYS} giorni con device): nessuna correzione.` };
  }
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const factor = Math.round(clamp(avg, CLAMP_MIN, CLAMP_MAX) * 100) / 100;
  return {
    factor,
    daysUsed: ratios.length,
    note: `Correzione TDEE dagli ultimi ${ratios.length} giorni con dato device: consumo reale ×${avg.toFixed(2)} sullo stimato → fattore ${factor}.`,
  };
}
