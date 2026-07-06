"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { normalizeDateKey, workoutDayKey } from "@/lib/training/calendar-analyzer-helpers";
import { plannedCalendarChipViewModel } from "@/lib/training/planned-workout-display";
import { useAthleteFtpWatts } from "@/lib/training/physiology/use-athlete-ftp-watts";
import { productHrefForPathname, useIsMobileApp } from "@/lib/shell/use-product-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysKey(baseKey: string, delta: number): string {
  const d = new Date(`${baseKey}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localDayKey(d);
}

const WEEKDAY_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTH_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
/** Buffer di giorni oltre il mese: scorrendo si vede un po' prima/dopo. */
const MONTH_EDGE_DAYS = 7;

type WindowData = { planned: PlannedWorkout[]; executed: ExecutedWorkout[] };
let windowCacheKey: string | null = null;
let windowCache: WindowData | null = null;

async function loadTrainingWindow(athleteId: string, from: string, to: string): Promise<WindowData> {
  const key = `${athleteId}|${from}|${to}`;
  if (windowCacheKey === key && windowCache) return windowCache;
  const q = new URLSearchParams({ athleteId, from, to });
  q.set("includePlanned", "1");
  q.set("includeExecuted", "1");
  q.set("includeAthleteContext", "0");
  q.set("includeTraceSummary", "0");
  q.set("includePlannedNotes", "0");
  const headers = await buildSupabaseAuthHeaders();
  const res = await fetch(`/api/training/planned-window?${q}`, { cache: "no-store", credentials: "same-origin", headers });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    planned?: PlannedWorkout[];
    executed?: ExecutedWorkout[];
    error?: string;
  };
  if (!res.ok || !json.ok) throw new Error(json.error || "Impossibile leggere le attività.");
  const data: WindowData = { planned: json.planned ?? [], executed: json.executed ?? [] };
  windowCacheKey = key;
  windowCache = data;
  return data;
}

type Activity = {
  title: string;
  sportLabel: string;
  minutes: number;
  glyph: ReturnType<typeof plannedCalendarChipViewModel>["glyph"] | null;
  done: boolean;
};
type DayGroup = { dayKey: string; dayLabel: string; isToday: boolean; activities: Activity[] };

/**
 * Elenco allenamenti (2026-07): semplicissimo. Per ogni giorno l'intestazione
 * data e sotto le sue attività, cliccabili → dettaglio seduta (`/training/session/{date}`).
 * Scorri in basso per i giorni successivi. Stesso su desktop e mobile.
 */
export default function TrainingCalendarTableView() {
  const { athleteId, adminScoped, loading: ctxLoading } = useActiveAthlete();
  const athleteFtpWatts = useAthleteFtpWatts(athleteId);
  const pathname = usePathname() ?? "/";
  const isMobileApp = useIsMobileApp();
  const t = useTranslations("TrainingCalendarPageView");
  const todayKey = localDayKey(new Date());

  // Mese visualizzato (default: il mese di oggi). «Mese precedente/successivo»
  // lo spostano; scorrendo dentro il mese si vede prima/dopo la data di oggi.
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const isCurrentMonth =
    monthCursor.getFullYear() === new Date().getFullYear() && monthCursor.getMonth() === new Date().getMonth();
  const monthTitle = `${MONTH_IT[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;

  const [data, setData] = useState<WindowData>({ planned: [], executed: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setData({ planned: [], executed: [] });
      setLoading(false);
      return;
    }
    let alive = true;
    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const from = addDaysKey(localDayKey(monthStart), -MONTH_EDGE_DAYS);
    const to = addDaysKey(localDayKey(monthEnd), MONTH_EDGE_DAYS);
    setLoading(true);
    loadTrainingWindow(athleteId, from, to)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setErr(null);
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "Errore di caricamento.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [athleteId, ctxLoading, monthCursor]);

  const days = useMemo<DayGroup[]>(() => {
    const plannedByDate = new Map<string, PlannedWorkout[]>();
    for (const w of data.planned) {
      const key = normalizeDateKey(w.date);
      if (!key) continue;
      (plannedByDate.get(key) ?? plannedByDate.set(key, []).get(key)!).push(w);
    }
    const executedByDate = new Map<string, ExecutedWorkout[]>();
    for (const w of data.executed) {
      const key = normalizeDateKey(workoutDayKey(w));
      if (!key) continue;
      (executedByDate.get(key) ?? executedByDate.set(key, []).get(key)!).push(w);
    }

    const dayKeys = [...new Set<string>([...plannedByDate.keys(), ...executedByDate.keys()])].sort();
    return dayKeys.map((dayKey) => {
      const [y, m, d] = dayKey.split("-").map(Number);
      const dateObj = new Date(y!, (m ?? 1) - 1, d ?? 1);
      const done = (executedByDate.get(dayKey) ?? []).length > 0;
      const planned = plannedByDate.get(dayKey) ?? [];
      const executed = executedByDate.get(dayKey) ?? [];

      const activities: Activity[] = planned.length
        ? planned.map((w) => {
            const vm = plannedCalendarChipViewModel(w, { athleteFtpWatts });
            return { title: vm.title, sportLabel: vm.sportLabel, minutes: vm.minutes, glyph: vm.glyph, done };
          })
        : executed.map((w) => ({
            title: "Seduta svolta",
            sportLabel: "",
            minutes: Math.round(w.durationMinutes ?? 0),
            glyph: null,
            done: true,
          }));

      return {
        dayKey,
        isToday: dayKey === todayKey,
        dayLabel: `${WEEKDAY_IT[dateObj.getDay()]} ${d} ${MONTH_IT[(m ?? 1) - 1]}`,
        activities,
      };
    });
  }, [data, athleteFtpWatts, todayKey]);

  const loadingFirst = (ctxLoading || loading) && days.length === 0;

  // Centra OGGI DENTRO al box (non la pagina) quando si guarda il mese corrente
  // (primo carico e click «Oggi»). Cambiando mese con le frecce NON si ricentra.
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const wantScrollToTodayRef = useRef(true);
  useEffect(() => {
    if (loading || days.length === 0 || !isCurrentMonth || !wantScrollToTodayRef.current) return;
    const box = scrollBoxRef.current;
    const el = box?.querySelector<HTMLElement>("[data-today]");
    if (box && el) {
      const boxRect = box.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      box.scrollTop += elRect.top - boxRect.top - (box.clientHeight - el.clientHeight) / 2;
    }
    wantScrollToTodayRef.current = false;
  }, [loading, days, isCurrentMonth]);

  const goPrevMonth = () => {
    wantScrollToTodayRef.current = false;
    setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    wantScrollToTodayRef.current = false;
    setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  };
  const goToday = () => {
    wantScrollToTodayRef.current = true;
    const d = new Date();
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-orange-400"
      title={t("title")}
      description={t("description")}
    >
      <div
        className={`mb-4${adminScoped ? " pointer-events-none opacity-50" : ""}`}
        title={adminScoped ? t("adminScopedTitle") : undefined}
      >
        {isMobileApp ? null : <TrainingSubnav />}
      </div>

      {/* Mese visualizzato + navigazione manuale mese precedente/successivo. */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-bold capitalize text-white">{monthTitle}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Mese precedente"
            onClick={goPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          {!isCurrentMonth ? (
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              Oggi
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Mese successivo"
            onClick={goNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {loadingFirst ? (
        <div className="min-h-[30vh] animate-pulse rounded-2xl bg-white/[0.03]" aria-hidden />
      ) : days.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center text-sm text-gray-400">
          Nessuna attività.
        </div>
      ) : (
        <div
          ref={scrollBoxRef}
          style={{ height: "34rem" }}
          className="space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-3"
        >
          {days.map((day) => (
            <div key={day.dayKey} data-today={day.isToday ? "1" : undefined}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className={`text-sm font-bold capitalize ${day.isToday ? "text-sky-300" : "text-gray-300"}`}>
                  {day.dayLabel}
                </span>
                {day.isToday ? (
                  <span className="text-[0.6rem] font-bold uppercase tracking-wide text-sky-300">Oggi</span>
                ) : null}
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                {day.activities.map((a, i) => {
                  const href = productHrefForPathname(`/training/session/${day.dayKey}`, pathname);
                  return (
                    <Link
                      key={`${day.dayKey}-${i}`}
                      href={href}
                      className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.04]"
                    >
                      {a.glyph ? (
                        <SportDisciplineGlyph glyph={a.glyph} className="h-7 w-7 shrink-0 text-gray-200" />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-gray-500">
                          <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-gray-100">{a.title}</span>
                        <span className="block truncate text-[0.72rem] text-gray-500">
                          {[a.sportLabel, a.minutes > 0 ? `${a.minutes}′` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {a.done ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Svolto" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {err ? (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</p>
      ) : null}
    </Pro2ModulePageShell>
  );
}
