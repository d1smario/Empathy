import type { SupabaseClient } from "@supabase/supabase-js";
import { computeWeeklyTdeeCorrection, type WeeklyTdeeCorrection } from "@/lib/nutrition/weekly-tdee-correction";
import { generateAndPersistMealPlanV2 } from "@/lib/nutrition/generate-meal-plan-v2-headless";

export type WeeklyReplanResult = {
  ok: boolean;
  weekStart: string;
  correction: WeeklyTdeeCorrection;
  days: Array<{ day: string; ok: boolean; slots?: number; error?: string }>;
};

function addDaysUTC(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Ripianificazione settimanale: rigenera i 7 giorni della settimana che parte da `weekStartMonday`
 * (la settimana PROSSIMA — mai la corrente), applicando il fattore di correzione TDEE imparato dagli
 * ultimi 7 giorni (`referenceDate` = oggi). Riusa il motore V2 headless (persist replace per data).
 */
export async function runWeeklyReplan(
  db: SupabaseClient,
  athleteId: string,
  weekStartMonday: string,
  referenceDate: string,
): Promise<WeeklyReplanResult> {
  const correction = await computeWeeklyTdeeCorrection(db, athleteId, referenceDate);
  const days = Array.from({ length: 7 }, (_, i) => addDaysUTC(weekStartMonday, i));
  const results: WeeklyReplanResult["days"] = [];
  for (const day of days) {
    const r = await generateAndPersistMealPlanV2(db, athleteId, day, { tdeeCorrectionFactor: correction.factor });
    results.push(r.ok ? { day, ok: true, slots: r.slots } : { day, ok: false, error: r.error });
  }
  return { ok: results.every((d) => d.ok), weekStart: weekStartMonday, correction, days: results };
}
