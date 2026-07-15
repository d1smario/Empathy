"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import { useCoachRoster } from "@/lib/coach/use-coach-roster";
import {
  CoachCalendarWeekGrid,
  type CoachCalendarDay,
} from "@/components/coach/CoachCalendarWeekGrid";
import { useCoachCalendarWeek } from "@/modules/training/services/use-coach-calendar-week";
import { fetchCoachLibraryItems } from "@/modules/training/services/training-library-api";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";

/** Chiave giorno locale `YYYY-MM-DD` (le colonne `date` dei workout sono date pure). */
function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Settimana lun→dom con offset (0 = corrente, ±1 = precedente/successiva). */
function weekMondayWithOffset(offset: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return monday;
}

export function CoachCalendarBoardView() {
  const t = useTranslations("CoachCalendarBoard");
  const locale = useLocale();
  const { athletes, loading: rosterLoading, error: rosterError, coachActivation } = useCoachRoster();

  const [weekOffset, setWeekOffset] = useState(0);

  const todayKey = useMemo(() => dayKey(new Date()), []);
  const { days, weekFrom, weekTo, rangeLabel } = useMemo(() => {
    const monday = weekMondayWithOffset(weekOffset);
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const list: CoachCalendarDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = dayKey(d);
      list.push({
        iso,
        label: dayFmt.format(d),
        dayNum: String(d.getDate()),
        isToday: iso === todayKey,
      });
    }
    const rangeFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const first = new Date(monday);
    const last = new Date(monday);
    last.setDate(monday.getDate() + 6);
    return {
      days: list,
      weekFrom: list[0]!.iso,
      weekTo: list[6]!.iso,
      rangeLabel: `${rangeFmt.format(first)} – ${rangeFmt.format(last)}`,
    };
  }, [weekOffset, locale, todayKey]);

  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);
  const { cells, loading: weekLoading, error: weekError } = useCoachCalendarWeek(athleteIds, weekFrom, weekTo);

  // Pannello sorgenti (sinistra): elenco sedute di libreria del coach — SOLA LETTURA, non trascinabili.
  const [libraryItems, setLibraryItems] = useState<CoachWorkoutLibraryItemView[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLibraryLoading(true);
    setLibraryError(null);
    (async () => {
      const { items, error } = await fetchCoachLibraryItems();
      if (cancelled) return;
      if (error) {
        setLibraryError(error);
        setLibraryItems([]);
      } else {
        setLibraryItems(items);
      }
      setLibraryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rosterErrText = rosterError
    ? rosterError.kind === "network"
      ? t("rosterErrorNetwork")
      : rosterError.message || t("rosterErrorLoad")
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      {/* SINISTRA — pannello sorgenti (sedute di libreria), non trascinabile in questo incremento. */}
      <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-cyan-300" aria-hidden />
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-400">{t("sourcesTitle")}</h2>
        </div>
        <p className="mt-1 text-[0.7rem] text-gray-500">{t("sourcesHint")}</p>

        {libraryLoading ? (
          <p className="mt-4 text-xs text-gray-500">{t("sourcesLoading")}</p>
        ) : libraryError ? (
          <p className="mt-4 text-xs text-amber-200" role="alert">
            {t("sourcesError")}
          </p>
        ) : libraryItems.length === 0 ? (
          <p className="mt-4 text-xs text-gray-500">{t("sourcesEmpty")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {libraryItems.map((item) => (
              <li
                key={item.id}
                className="cursor-default select-none rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
              >
                <p className="truncate text-sm font-medium text-white">{item.title}</p>
                <p className="mt-0.5 text-[0.7rem] text-gray-500">
                  <span className="uppercase tracking-wide">{t(`family.${item.family}`)}</span>
                  {" · "}
                  {item.durationMinutes}m
                  {" · "}
                  {LOAD_CHIP_LABEL} {item.tssTarget}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* DESTRA — griglia settimana × atleti (sola lettura). */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((n) => n - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
              aria-label={t("prevWeek")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[7rem] text-center text-sm font-semibold text-white tabular-nums">{rangeLabel}</span>
            <button
              type="button"
              onClick={() => setWeekOffset((n) => n + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
              aria-label={t("nextWeek")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            {weekOffset !== 0 ? (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-gray-300 transition hover:border-white/25 hover:text-white"
              >
                {t("today")}
              </button>
            ) : null}
          </div>
          {weekLoading && athleteIds.length > 0 ? (
            <span className="text-[0.7rem] text-gray-500">{t("weekLoading")}</span>
          ) : null}
        </div>

        {coachActivation === "suspended" ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-sm text-rose-100" role="status">
            {t("coachSuspended")}
          </p>
        ) : null}

        {rosterErrText ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {rosterErrText}
          </p>
        ) : null}

        {weekError ? (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
            {t("weekError")}
          </p>
        ) : null}

        {rosterLoading && athletes.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
            {t("rosterLoading")}
          </div>
        ) : !rosterLoading && athletes.length === 0 && !rosterErrText ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
            {t("noAthletes")}
          </div>
        ) : athletes.length > 0 ? (
          <CoachCalendarWeekGrid athletes={athletes} days={days} cells={cells} />
        ) : null}
      </section>
    </div>
  );
}
