import type { PlannedWorkoutDbRow } from "@empathy/domain-training";
import type { BioPlannedMealRow } from "@/lib/bioenergetics/nutrition-plan-day-empty";
import type { NutritionModuleFlatProfile } from "@/lib/nutrition/nutrition-module-profile-merge";
import { getScheduledTimeFromPlannedRow } from "@/lib/training/builder/pro2-session-notes";
import type { TodayEvent, TodayFoodItem, TodayHydration, TodayReadiness } from "@/app/api/today/contracts";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizeHhMm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  const m = /^\d{1,2}:\d{2}/.exec(t);
  return m ? m[0] : null;
}

function isoDateToWeekDayKey(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "Mon";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Mon";
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[d.getDay()] ?? "Mon";
}

function timeFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function minutesOf(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function eventStatusForTimeRange(startTime: string, durationMinutes: number): TodayEvent["status"] {
  const start = minutesOf(startTime);
  if (start == null) return "todo";
  const now = nowMinutes();
  const end = start + durationMinutes;
  if (now >= start && now < end) return "current";
  if (now >= end) return "todo"; // lasciamo all'azione esplicita il "done"
  return "todo";
}

export type BuildTodayEventsInput = {
  date: string;
  profile: NutritionModuleFlatProfile | null;
  plannedWorkouts: PlannedWorkoutDbRow[];
  executedWorkouts: Array<{
    id: string;
    planned_workout_id?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    duration_minutes?: number | null;
    tss?: number | null;
    kcal?: number | null;
  }>;
  plannedMeals: BioPlannedMealRow[];
  diaryItems: TodayFoodItem[];
  hydration: TodayHydration;
  readiness: TodayReadiness;
};

function mealKeyForSlot(slot: string): string {
  switch (slot) {
    case "breakfast":
      return "meal.breakfast";
    case "lunch":
      return "meal.lunch";
    case "dinner":
      return "meal.dinner";
    case "snack_am":
      return "meal.snackMorning";
    case "snack_pm":
      return "meal.snackAfternoon";
    case "snack_evening":
      return "meal.snackEvening";
    default:
      return "meal.fallback";
  }
}

function mealTypeForSlot(slot: string): TodayEvent["type"] {
  return slot === "breakfast" || slot === "lunch" || slot === "dinner" ? "meal" : "snack";
}

function dailySupplements(
  profile: NutritionModuleFlatProfile | null,
  supplementConfig: Record<string, unknown>,
): string[] {
  const fromProfile = Array.isArray(profile?.supplements)
    ? profile.supplements.filter((s): s is string => typeof s === "string")
    : [];
  const fromConfigSupps = Array.isArray(supplementConfig.supplements)
    ? supplementConfig.supplements.filter((s): s is string => typeof s === "string")
    : [];
  const fromConfigBrands = Array.isArray(supplementConfig.selected_brands)
    ? supplementConfig.selected_brands.filter((s): s is string => typeof s === "string")
    : [];
  return Array.from(new Set([...fromProfile, ...fromConfigSupps, ...fromConfigBrands]));
}

export function buildTodayEvents(input: BuildTodayEventsInput): TodayEvent[] {
  const { date, profile, plannedWorkouts, executedWorkouts, plannedMeals, diaryItems, hydration, readiness } = input;
  const routineConfig = asRecord(profile?.routine_config);
  const nutritionConfig = asRecord(profile?.nutrition_config);
  const supplementConfig = asRecord(profile?.supplement_config);

  const weekPlan = asRecord(routineConfig.week_plan);
  const dayKey = isoDateToWeekDayKey(date);
  const dayRoutine = asRecord(weekPlan[dayKey]);

  const events: TodayEvent[] = [];

  // Sveglia
  const wakeTime = normalizeHhMm(dayRoutine.wake_time ?? routineConfig.wake_time);
  if (wakeTime) {
    events.push({
      id: "wake",
      type: "wake",
      time: wakeTime,
      title: "Sveglia",
      titleKey: "wakeTitle",
      subtitleKey: "wakeSubtitle",
      status: nowMinutes() > minutesOf(wakeTime)! ? "done" : "todo",
      accent: "fuchsia",
    });
  }

  // Integrazione giornaliera
  const supplements = dailySupplements(profile, supplementConfig);
  if (supplements.length > 0 || Object.keys(supplementConfig).length > 0) {
    const supplementTime = wakeTime ? addMinutes(wakeTime, 15) : "07:15";
    const subtitle = supplements.length > 0 ? supplements.join(", ") : "Integrazione giornaliera";
    events.push({
      id: "supplement-daily",
      type: "supplement",
      time: supplementTime,
      title: "Integrazione",
      titleKey: "supplementTitle",
      subtitle,
      subtitleKey: supplements.length > 0 ? undefined : "supplementDaily",
      status: "todo",
      accent: "violet",
      data: { supplements },
    });
  }

  // Idrazione già registrata
  const hydrationAll = asRecord(nutritionConfig.hydration_intake);
  const hydrationDay = asRecord(hydrationAll[date]);
  const hydrationAt = typeof hydrationDay.at === "string" ? timeFromIso(hydrationDay.at) : null;
  const hydrationMl = Number(hydrationDay.ml) || 0;
  if (hydrationMl > 0 && hydrationAt) {
    events.push({
      id: "hydration-logged",
      type: "hydration",
      time: hydrationAt,
      title: `Hai bevuto ${hydrationMl} ml`,
      titleKey: "hydrationLogged",
      status: "done",
      accent: "cyan",
      data: { ml: hydrationMl },
    });
  }

  // Pasti
  const mealConfirmationsAll = asRecord(nutritionConfig.meal_confirmations);
  const mealConfirmationsDay = asRecord(mealConfirmationsAll[date]);

  for (const meal of plannedMeals) {
    const time = timeFromIso(meal.entry_time);
    if (!time) continue;
    const confirmed = !!mealConfirmationsDay[meal.slot];
    const items = diaryItems.filter((i) => i.mealSlot === meal.slot);
    events.push({
      id: `meal-${meal.slot}`,
      type: mealTypeForSlot(meal.slot),
      time,
      title: mealKeyForSlot(meal.slot),
      titleKey: mealKeyForSlot(meal.slot),
      subtitle: `${Math.round(meal.kcal)} kcal · P${Math.round(meal.protein_g ?? 0)} · C${Math.round(meal.carbs_g ?? 0)} · G${Math.round(meal.fat_g ?? 0)}`,
      status: confirmed ? "done" : "todo",
      accent: "amber",
      data: { slot: meal.slot, kcal: meal.kcal, protein: meal.protein_g, carbs: meal.carbs_g, fat: meal.fat_g },
      items,
    });
  }

  // Allenamenti
  for (const planned of plannedWorkouts) {
    const executed = executedWorkouts.find((e) => e.planned_workout_id === planned.id);
    const scheduledTime = getScheduledTimeFromPlannedRow(planned, routineConfig);
    const duration = Number(planned.duration_minutes) || 60;
    const title = planned.type ? `${planned.type} · ${duration}'` : `Allenamento · ${duration}'`;
    const subtitleParts: string[] = [];
    if (planned.tss_target) subtitleParts.push(`TSS ${Math.round(Number(planned.tss_target))}`);
    if (planned.kcal_target) subtitleParts.push(`${Math.round(Number(planned.kcal_target))} kcal`);

    if (executed?.started_at) {
      const startTime = timeFromIso(executed.started_at);
      events.push({
        id: `workout-${planned.id}`,
        type: "workout",
        time: startTime,
        title: `Allenamento completato · ${duration}'`,
        titleKey: "workoutCompleted",
        subtitle: subtitleParts.join(" · "),
        status: "done",
        accent: "orange",
        data: { plannedId: planned.id, executedId: executed.id, duration },
      });
    } else if (scheduledTime) {
      events.push({
        id: `workout-${planned.id}`,
        type: "workout",
        time: scheduledTime,
        title,
        subtitle: subtitleParts.join(" · "),
        status: eventStatusForTimeRange(scheduledTime, duration),
        accent: "orange",
        data: { plannedId: planned.id },
        actions: [
          { key: "start", label: "Avvia", i18nKey: "actionStart", variant: "primary" },
          { key: "done", label: "Completato", i18nKey: "actionDone", variant: "secondary" },
        ],
      });
    } else {
      // Evento floating senza orario: verrà mostrato sopra la timeline dalla pagina.
    }
  }

  // Sonno
  const sleepTime = normalizeHhMm(dayRoutine.night_time ?? routineConfig.sleep_time);
  if (sleepTime) {
    events.push({
      id: "sleep",
      type: "sleep",
      time: sleepTime,
      title: "Sonno",
      titleKey: "sleepTitle",
      subtitleKey: "sleepSubtitle",
      status: "todo",
      accent: "fuchsia",
    });
  }

  // Ordina per orario; gli eventi senza orario vanno in fondo (qui non ce ne sono).
  events.sort((a, b) => {
    const ma = minutesOf(a.time);
    const mb = minutesOf(b.time);
    if (ma == null && mb == null) return 0;
    if (ma == null) return 1;
    if (mb == null) return -1;
    return ma - mb;
  });

  return events;
}

export function buildFloatingWorkout(input: {
  plannedWorkouts: PlannedWorkoutDbRow[];
  executedWorkouts: BuildTodayEventsInput["executedWorkouts"];
}): { id: string; title: string; subtitle?: string; durationMinutes: number } | null {
  const { plannedWorkouts, executedWorkouts } = input;
  for (const planned of plannedWorkouts) {
    const executed = executedWorkouts.find((e) => e.planned_workout_id === planned.id);
    if (executed) continue;
    const duration = Number(planned.duration_minutes) || 60;
    const title = planned.type ? `${planned.type} · ${duration}'` : `Allenamento · ${duration}'`;
    const subtitleParts: string[] = [];
    if (planned.tss_target) subtitleParts.push(`TSS ${Math.round(Number(planned.tss_target))}`);
    if (planned.kcal_target) subtitleParts.push(`${Math.round(Number(planned.kcal_target))} kcal`);
    return { id: `workout-floating-${planned.id}`, title, subtitle: subtitleParts.join(" · "), durationMinutes: duration };
  }
  return null;
}
