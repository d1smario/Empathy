"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DailyCheckinCard } from "@/components/dashboard/DailyCheckinCard";
import { TwinFigureArt } from "@/components/dashboard/TwinFigureArt";
import { CalendarDayWellnessDetail } from "@/components/training/CalendarDayWellnessDetail";
import { useDashboardScores } from "@/lib/dashboard/use-dashboard-scores";
import { TodayHeader } from "./TodayHeader";
import { TodayHydrationTracker } from "./TodayHydrationTracker";
import { TodayTimeline } from "./TodayTimeline";
import { useNutritionQuickActions } from "@/modules/nutrition/hooks/use-nutrition-quick-actions";
import { setScheduledTimeInPlannedNotes } from "@/lib/training/builder/pro2-session-notes";
import { patchPlannedWorkout } from "@/modules/training/services/training-planned-api";
import type { TodayApiResponse } from "@/app/api/today/contracts";

export type TodayPageViewProps = {
  athleteId: string;
  date: string;
  firstName: string | null;
};

export function TodayPageView({ athleteId, date, firstName }: TodayPageViewProps) {
  const t = useTranslations("TodayPage");
  const [data, setData] = useState<TodayApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: scoresData } = useDashboardScores();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/today?athleteId=${encodeURIComponent(athleteId)}&date=${encodeURIComponent(date)}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as TodayApiResponse;
      if (!res.ok || !json.ok) {
        setError(("error" in json && json.error) || t("errorLoading"));
      } else {
        setData(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorNetwork"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [athleteId, date]);

  const profileLike = data?.ok
    ? {
        nutrition_config: data.nutritionConfig,
        routine_config: data.routineConfig,
      }
    : null;

  const { addHydration, confirmMeal, busySlot, hydrationBusy, error: actionError } = useNutritionQuickActions({
    athleteId,
    date,
    profile: profileLike,
    onConfigChange: () => void load(),
  });

  // «Fissa orario» sul blocco seduta senza orario: scrive scheduledTime nel contratto
  // builder dentro le notes (PATCH planned) e ricarica la giornata.
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const scheduleWorkout = async (plannedId: string, hhmm: string) => {
    if (!data?.ok) return;
    const ev = data.events.find((e) => String(e.data?.plannedId ?? "") === plannedId);
    const notes = typeof ev?.data?.notes === "string" ? ev.data.notes : null;
    const nextNotes = setScheduledTimeInPlannedNotes(notes, hhmm);
    if (!nextNotes) {
      setScheduleError(t("scheduleFailed"));
      return;
    }
    setScheduleBusyId(plannedId);
    setScheduleError(null);
    try {
      await patchPlannedWorkout({ id: plannedId, athleteId, patch: { notes: nextNotes } });
      await load();
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : t("scheduleFailed"));
    } finally {
      setScheduleBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="px-4 py-6">
        <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-gray-500">{t("loading")}</p>
      </div>
    );
  }

  if (error || !data || !data.ok) {
    return (
      <div className="px-4 py-6">
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100" role="alert">
          {error || t("noData")}
        </p>
      </div>
    );
  }

  const readiness = scoresData?.readiness ?? { score: null, label: null };

  return (
    <div className="relative min-h-screen bg-black px-4 pb-28 pt-4 sm:px-6">
      {/* max-w-6xl come le altre viste modulo (Pro2ModulePageShell): su desktop la
          pagina sfrutta l'intera larghezza; su mobile resta invariata (schermo < 6xl). */}
      <div className="mx-auto max-w-6xl space-y-6">
        <TodayHeader firstName={firstName} date={date} readiness={readiness} />

        {/* Dati device del giorno (sonno+fasi, passi/obiettivo, km, HRV, FC riposo,
            kcal attive, respirazione, SpO2): stesso pannello del calendario Training,
            alimentato da /api/health/daily-wellness (device_sync_exports). Con l'omino
            twin (solo figura, come «Analisi» ma senza HUD) nel terzo di destra;
            su mobile l'omino viene prima dei contatori. */}
        <CalendarDayWellnessDetail
          athleteId={athleteId}
          selectedDate={date}
          aside={<TwinFigureArt className="h-full" />}
          hideHeader
        />

        <TodayHydrationTracker
          targetMl={data.hydration.targetMl}
          currentMl={data.hydration.currentMl}
          onAddIntake={addHydration}
          busy={hydrationBusy}
        />

        {actionError || scheduleError ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="alert">
            {actionError || scheduleError}
          </p>
        ) : null}

        {/* La seduta senza orario ora vive DENTRO la timeline (blocco «da fissare»
            con anteprima + chips orario): niente più card flottante separata. */}
        <TodayTimeline
          events={data.events}
          onConfirmMeal={confirmMeal}
          onAddHydration={addHydration}
          onScheduleWorkout={(plannedId, hhmm) => void scheduleWorkout(plannedId, hhmm)}
          confirmBusySlot={busySlot}
          hydrationBusy={hydrationBusy}
          scheduleBusyId={scheduleBusyId}
        />

        {/* Check-in di oggi: ultima sezione della pagina (atleta e coach; in scope
            coach/admin è read-only, gate dentro la card). */}
        <DailyCheckinCard athleteId={athleteId} />
      </div>
    </div>
  );
}
