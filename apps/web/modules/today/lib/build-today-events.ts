import type { PlannedWorkoutDbRow } from "@empathy/domain-training";
import type { BioPlannedMealRow } from "@/lib/bioenergetics/nutrition-plan-day-empty";
import type { NutritionModuleFlatProfile } from "@/lib/nutrition/nutrition-module-profile-merge";
import type { TodayPlannedMealSlot } from "@/lib/nutrition/load-today-planned-meals";
import { getScheduledTimeFromPlannedRow, parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
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
  /** Piano pasti persistito dal motore DB (cibi reali). Prevale sui macro-solver quando presente. */
  persistedMeals?: TodayPlannedMealSlot[];
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
  const { date, profile, plannedWorkouts, executedWorkouts, plannedMeals, persistedMeals, diaryItems, hydration, readiness } = input;
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

  // Pasti. Il diario (timbrato con l'orario) è la fonte di verità del consumato: un pasto
  // è "done" se ci sono voci a diario per quello slot — niente più «segna fatto» manuale.
  // I CIBI mostrati vengono dal piano PERSISTITO dal motore DB (cibi reali + grammi +
  // immagini); se il giorno non ha un piano persistito si ripiega sui macro del solver.
  const persistedBySlot = new Map<string, TodayPlannedMealSlot>();
  for (const pm of persistedMeals ?? []) persistedBySlot.set(pm.slot, pm);

  for (const meal of plannedMeals) {
    const time = timeFromIso(meal.entry_time);
    if (!time) continue;
    const persisted = persistedBySlot.get(meal.slot);
    const diaryForSlot = diaryItems.filter((i) => i.mealSlot === meal.slot);
    const consumed = diaryForSlot.length > 0;

    // «Cosa mangiare» = cibi del piano persistito (se c'è), altrimenti le voci a diario.
    const items: TodayFoodItem[] = persisted
      ? persisted.foods.map((f) => ({
          mealSlot: meal.slot,
          foodLabel: f.label,
          quantityG: f.grams,
          kcal: f.kcal,
          carbsG: 0,
          proteinG: 0,
          fatG: 0,
          macroRole: f.macroRole,
          imageUrl: f.imageUrl,
        }))
      : diaryForSlot;

    const kcal = persisted ? persisted.kcal : Math.round(meal.kcal);
    const proteinG = persisted ? persisted.proteinG : Math.round(meal.protein_g ?? 0);
    const carbsG = persisted ? persisted.carbsG : Math.round(meal.carbs_g ?? 0);
    const fatG = persisted ? persisted.fatG : Math.round(meal.fat_g ?? 0);

    events.push({
      id: `meal-${meal.slot}`,
      type: mealTypeForSlot(meal.slot),
      time,
      title: mealKeyForSlot(meal.slot),
      titleKey: mealKeyForSlot(meal.slot),
      subtitle: `${kcal} kcal · P${proteinG} · C${carbsG} · G${fatG}`,
      status: consumed ? "done" : "todo",
      accent: "amber",
      data: { slot: meal.slot, kcal, protein: proteinG, carbs: carbsG, fat: fatG, consumed, fromPlan: !!persisted },
      items,
    });
  }

  // Allenamenti: SEMPRE dentro la timeline. Con orario (contract/routine) → posizionati;
  // senza orario → blocco "da fissare" (sortHint pomeriggio) con chips «Fissa orario»
  // se le notes hanno un contratto builder dove ancorare lo scheduledTime. `notes`
  // viaggia nell'evento per l'anteprima blocchi (BuilderPlannedSessionViz) lato client.
  for (const planned of plannedWorkouts) {
    const executed = executedWorkouts.find((e) => e.planned_workout_id === planned.id);
    const scheduledTime = getScheduledTimeFromPlannedRow(planned, routineConfig);
    const duration = Number(planned.duration_minutes) || 60;
    const title = planned.type ? `${planned.type} · ${duration}'` : `Allenamento · ${duration}'`;
    const subtitleParts: string[] = [];
    if (planned.tss_target) subtitleParts.push(`TSS ${Math.round(Number(planned.tss_target))}`);
    if (planned.kcal_target) subtitleParts.push(`${Math.round(Number(planned.kcal_target))} kcal`);
    const notes = typeof planned.notes === "string" ? planned.notes : null;
    const schedulable = parsePro2BuilderSessionFromNotes(notes) != null;

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
        data: { plannedId: planned.id, executedId: executed.id, duration, notes, detailDate: date },
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
        data: { plannedId: planned.id, duration, notes, detailDate: date },
      });
    } else {
      events.push({
        id: `workout-${planned.id}`,
        type: "workout",
        time: null,
        title,
        subtitle: subtitleParts.join(" · "),
        status: "todo",
        accent: "orange",
        data: {
          plannedId: planned.id,
          duration,
          notes,
          detailDate: date,
          toSchedule: true,
          schedulable,
          /** Sort: senza orario il blocco vive nel pomeriggio (17:00), non dopo il sonno. */
          sortHintMinutes: 17 * 60,
        },
      });
    }
  }

  // Idratazione a tappe: obiettivo CUMULATIVO lungo la giornata (35% → 70% → 100%).
  // Le tappe sono un PIANO (prescrittivo); il progresso confrontato è il bevuto REALE.
  if (hydration.targetMl > 0) {
    const checkpoints: Array<{ time: string; share: number }> = [
      { time: "10:30", share: 0.35 },
      { time: "15:00", share: 0.7 },
      { time: "20:00", share: 1 },
    ];
    for (const cp of checkpoints) {
      const cumTargetMl = Math.round((hydration.targetMl * cp.share) / 50) * 50;
      const reached = hydration.currentMl >= cumTargetMl;
      const late = !reached && nowMinutes() > (minutesOf(cp.time) ?? 0);
      events.push({
        id: `hydration-cp-${cp.time}`,
        type: "hydration",
        time: cp.time,
        title: `Idratazione · ${(cumTargetMl / 1000).toFixed(1)} L`,
        titleKey: "hydrationCheckpoint",
        status: reached ? "done" : late ? "current" : "todo",
        accent: "cyan",
        data: { checkpoint: true, cumTargetMl, currentMl: hydration.currentMl },
      });
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

  // Ordina per orario; gli eventi senza orario usano il sortHint (es. workout da
  // fissare → pomeriggio), altrimenti vanno in fondo.
  const sortKey = (e: TodayEvent): number => {
    const m = minutesOf(e.time);
    if (m != null) return m;
    const hint = Number(e.data?.sortHintMinutes);
    return Number.isFinite(hint) ? hint : Number.MAX_SAFE_INTEGER;
  };
  events.sort((a, b) => sortKey(a) - sortKey(b));

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
