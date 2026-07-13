import { NextRequest, NextResponse } from "next/server";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import { requireAthleteReadContext, AthleteReadContextError } from "@/lib/auth/athlete-read-context";
import { buildOperationalDayHub } from "@/lib/operational/build-operational-day-hub";
import { loadNutritionPlanDayContext } from "@/lib/bioenergetics/load-nutrition-plan-for-day";
import { computeDailyHydrationTargetMl } from "@/lib/nutrition/hydration-target";
import type { PlannedWorkout } from "@empathy/domain-training";
import type { NutritionModuleFlatProfile } from "@/lib/nutrition/nutrition-module-profile-merge";
import { buildTodayEvents, buildFloatingWorkout } from "@/modules/today/lib/build-today-events";
import type { TodayApiResponse, TodayFoodItem } from "./contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function localCalendarDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizeHhMm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  const m = /^\d{1,2}:\d{2}/.exec(t);
  return m ? m[0] : null;
}

export async function GET(req: NextRequest): Promise<NextResponse<TodayApiResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get("athleteId")?.trim() ?? "";
    const date = searchParams.get("date")?.trim() || localCalendarDateString();

    if (!athleteId) {
      return NextResponse.json({ ok: false, error: "Missing athleteId" }, { status: 400 });
    }

    await requireAthleteReadContext(req, athleteId);
    const db = createSupabaseCookieClient();
    if (!db) {
      return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
    }

    // Training + profilo + fueling context
    const hub = await buildOperationalDayHub({ db, athleteId, date });
    if (!hub.ok) {
      return NextResponse.json({ ok: false, error: hub.error }, { status: 500 });
    }

    // Pasti pianificati del giorno (macro solver — usati come scheletro slot/orario)
    const nutritionCtx = await loadNutritionPlanDayContext(db, athleteId, date, hub.planned as unknown as PlannedWorkout[]);

    // Cibi già registrati nel diario per il giorno (per marcare "consumato" gli slot pasto).
    // Oggi NON legge/genera il piano pasti: i cibi si vedono nel Piano (link «Apri nel Piano»).
    const { data: diaryRows } = await db
      .from("food_diary_entries")
      .select("meal_slot, food_label, quantity_g, kcal, carbs_g, protein_g, fat_g")
      .eq("athlete_id", athleteId)
      .eq("entry_date", date)
      .order("created_at", { ascending: true });
    const diaryItems: TodayFoodItem[] = ((diaryRows ?? []) as Record<string, unknown>[]).map((r) => ({
      mealSlot: String(r.meal_slot ?? ""),
      foodLabel: String(r.food_label ?? ""),
      quantityG: Number(r.quantity_g) || 0,
      kcal: Number(r.kcal) || 0,
      carbsG: Number(r.carbs_g) || 0,
      proteinG: Number(r.protein_g) || 0,
      fatG: Number(r.fat_g) || 0,
    }));

    // Profilo atleta per nome e pesi
    const profileRes = await db
      .from("athlete_profiles")
      .select("first_name, weight_kg")
      .eq("id", athleteId)
      .maybeSingle();
    const firstName = typeof profileRes.data?.first_name === "string" ? profileRes.data.first_name : null;
    const weightKg = typeof profileRes.data?.weight_kg === "number" ? profileRes.data.weight_kg : null;

    // Idratazione: STESSA formula di Nutrizione (card «Quanto bere oggi») via helper condiviso —
    // base peso×33 (min 2200) + extra allenamento. Prima Oggi usava peso×35 → numero diverso.
    const nutritionConfig = asRecord(hub.profile?.nutrition_config);
    const hydrationAll = asRecord(nutritionConfig.hydration_intake);
    const hydrationDay = asRecord(hydrationAll[date]);
    const currentMl = Number(hydrationDay.ml) || 0;
    const sessionDurationMin = hub.planned.reduce((sum, p) => sum + (Number(p.duration_minutes) || 0), 0);
    const targetMl = computeDailyHydrationTargetMl({ weightKg, sessionDurationMin }).totalMl;

    // Eventi eseguiti (formato compatibile)
    const executedRows = (hub.executed as Array<Record<string, unknown>>).map((e) => ({
      id: String(e.id ?? ""),
      planned_workout_id: e.planned_workout_id ? String(e.planned_workout_id) : null,
      started_at: typeof e.started_at === "string" ? e.started_at : null,
      ended_at: typeof e.ended_at === "string" ? e.ended_at : null,
      duration_minutes: typeof e.duration_minutes === "number" ? e.duration_minutes : null,
      tss: typeof e.tss === "number" ? e.tss : null,
      kcal: typeof e.kcal === "number" ? e.kcal : null,
    }));

    const events = buildTodayEvents({
      date,
      profile: hub.profile,
      plannedWorkouts: hub.planned,
      executedWorkouts: executedRows,
      plannedMeals: nutritionCtx.plannedMeals,
      diaryItems,
      hydration: { targetMl, currentMl },
      readiness: { score: null, label: null }, // caricato client-side
    });

    // Allenamento senza orario: separato dalla timeline
    const floatingWorkout = buildFloatingWorkout({
      plannedWorkouts: hub.planned,
      executedWorkouts: executedRows,
    });

    // Domani preview (leggero)
    const tomorrow = null; // TODO: implementare preview giorno successivo

    // Aggiustamenti adattivi del giorno (reintegro/riduzione) — extra sopra il piano base.
    const { data: adjRows } = await db
      .from("nutrition_daily_adjustment")
      .select("kind, extra_kcal, extra_carbs_g, extra_water_ml, extra_supplements, reason")
      .eq("athlete_id", athleteId)
      .eq("date", date);
    const adjustments = ((adjRows ?? []) as Record<string, unknown>[]).map((r) => ({
      kind: r.kind === "reduction" ? ("reduction" as const) : ("reintegration" as const),
      extraKcal: Number(r.extra_kcal) || 0,
      extraCarbsG: Number(r.extra_carbs_g) || 0,
      extraWaterMl: Number(r.extra_water_ml) || 0,
      supplements: Array.isArray(r.extra_supplements) ? (r.extra_supplements as string[]) : [],
      reason: typeof r.reason === "string" ? r.reason : null,
    }));

    return NextResponse.json({
      ok: true,
      date,
      athleteId,
      firstName,
      nutritionConfig: nutritionConfig,
      routineConfig: asRecord(hub.profile?.routine_config),
      readiness: { score: null, label: null },
      hydration: { targetMl, currentMl },
      events,
      floatingWorkout,
      tomorrow,
      adjustments,
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to load today data";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
