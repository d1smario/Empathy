"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Dumbbell } from "lucide-react";
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

/** YYYY-MM-DD locale. */
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
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/** Finestra ampia: l'atleta vede TUTTE le sue attività, non solo il mese corrente. */
const WINDOW_BACK_DAYS = 180;
const WINDOW_FWD_DAYS = 60;

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
  const res = await fetch(`/api/training/planned-window?${q}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
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

type TableRow = {
  dayKey: string;
  isToday: boolean;
  monthHeader: string | null;
  weekdayLabel: string;
  dayNumber: string;
  monthShort: string;
  firstOfDay: boolean;
  glyph: ReturnType<typeof plannedCalendarChipViewModel>["glyph"] | null;
  sportLabel: string;
  title: string;
  minutes: number;
  load: number;
  done: boolean;
};

/**
 * Vista TABELLA del calendario Allenamento (2026-07): elenco «cosa faccio» di
 * TUTTE le attività (finestra ampia, non solo il mese) — una riga per attività
 * raggruppata per giorno, con separatori di mese. Clic su una riga → dettaglio
 * seduta live (`/training/session/{date}`). Responsive: tabella su desktop,
 * lista di card su mobile. Fetch light dedicato via planned-window.
 */
export default function TrainingCalendarTableView() {
  const { athleteId, adminScoped, loading: ctxLoading } = useActiveAthlete();
  const athleteFtpWatts = useAthleteFtpWatts(athleteId);
  const pathname = usePathname() ?? "/";
  const isMobileApp = useIsMobileApp();
  const t = useTranslations("TrainingCalendarPageView");
  const todayKey = localDayKey(new Date());

  const [data, setData] = useState<WindowData>(() => windowCache ?? { planned: [], executed: [] });
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
    const from = addDaysKey(todayKey, -WINDOW_BACK_DAYS);
    const to = addDaysKey(todayKey, WINDOW_FWD_DAYS);
    setLoading(true);
    loadTrainingWindow(athleteId, from, to)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setErr(null);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Errore di caricamento.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [athleteId, ctxLoading, todayKey]);

  const rows = useMemo<TableRow[]>(() => {
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

    const dayKeys = new Set<string>([...plannedByDate.keys(), ...executedByDate.keys()]);
    const sorted = [...dayKeys].sort();

    const out: TableRow[] = [];
    let prevMonth = "";
    for (const dayKey of sorted) {
      const [y, m, d] = dayKey.split("-").map(Number);
      const dateObj = new Date(y!, (m ?? 1) - 1, d ?? 1);
      const monthKey = `${MONTH_IT[(m ?? 1) - 1]} ${y}`;
      const monthHeader = monthKey !== prevMonth ? monthKey : null;
      prevMonth = monthKey;
      const dayMeta = {
        dayKey,
        isToday: dayKey === todayKey,
        weekdayLabel: WEEKDAY_IT[dateObj.getDay()]!,
        dayNumber: String(d ?? 1).padStart(2, "0"),
        monthShort: (MONTH_IT[(m ?? 1) - 1] ?? "").slice(0, 3),
      };
      const planned = plannedByDate.get(dayKey) ?? [];
      const executedRows = executedByDate.get(dayKey) ?? [];
      const dayDone = executedRows.length > 0;

      if (planned.length) {
        planned.forEach((w, i) => {
          const vm = plannedCalendarChipViewModel(w, { athleteFtpWatts });
          out.push({
            ...dayMeta,
            monthHeader: i === 0 ? monthHeader : null,
            firstOfDay: i === 0,
            glyph: vm.glyph,
            sportLabel: vm.sportLabel,
            title: vm.title,
            minutes: vm.minutes,
            load: vm.load,
            done: dayDone,
          });
        });
      } else if (dayDone) {
        // Giorno con seduta svolta ma non pianificata: una riga per esecuzione,
        // con la sua durata/TSS (executed non porta lo sport).
        executedRows.forEach((w, i) => {
          out.push({
            ...dayMeta,
            monthHeader: i === 0 ? monthHeader : null,
            firstOfDay: i === 0,
            glyph: null,
            sportLabel: "Seduta svolta",
            title: "Seduta svolta",
            minutes: Math.round(w.durationMinutes ?? 0),
            load: Math.round(w.tss ?? 0),
            done: true,
          });
        });
      }
    }
    return out;
  }, [data, athleteFtpWatts, todayKey]);

  const loadingFirst = (ctxLoading || loading) && rows.length === 0;

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

      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300">
          <CalendarDays className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <div className="text-sm font-bold text-white">Le tue attività</div>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-gray-500">
            Clicca una riga per aprire la seduta{rows.length ? ` · ${rows.length}` : ""}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {loadingFirst ? (
          <div className="min-h-[30vh] animate-pulse bg-white/[0.03]" aria-hidden />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <Dumbbell className="h-6 w-6 text-gray-600" aria-hidden />
            <p className="text-sm text-gray-400">Nessuna attività negli ultimi mesi.</p>
          </div>
        ) : (
          <>
            {/* Desktop: tabella. Mobile: stessa roba come lista di card (sotto). */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Giorno</th>
                    <th className="px-4 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Attività</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Durata</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Carico</th>
                    <th className="px-4 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Stato</th>
                    <th className="px-4 py-2.5" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const href = productHrefForPathname(`/training/session/${r.dayKey}`, pathname);
                    return (
                      <Fragment key={`row-${r.dayKey}-${idx}`}>
                        {r.monthHeader ? (
                          <tr className="bg-white/[0.03]">
                            <td colSpan={6} className="px-4 py-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-sky-300/80">
                              {r.monthHeader}
                            </td>
                          </tr>
                        ) : null}
                        <tr
                          className={`group border-b border-white/[0.06] transition-colors hover:bg-white/[0.04] ${
                            r.isToday ? "bg-sky-500/[0.06]" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 align-middle">
                            {r.firstOfDay ? (
                              <Link href={href} className="flex items-center gap-2">
                                <span
                                  className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${
                                    r.isToday ? "border-sky-400/50 bg-sky-500/15 text-sky-100" : "border-white/10 bg-black/30 text-gray-300"
                                  }`}
                                >
                                  <span className="text-sm font-bold leading-none">{r.dayNumber}</span>
                                  <span className="text-[0.55rem] uppercase leading-none text-gray-500">{r.monthShort}</span>
                                </span>
                                <span className="leading-tight">
                                  <span className="block text-xs font-semibold text-gray-200">{r.weekdayLabel}</span>
                                  {r.isToday ? (
                                    <span className="text-[0.6rem] font-bold uppercase tracking-wide text-sky-300">Oggi</span>
                                  ) : null}
                                </span>
                              </Link>
                            ) : (
                              <span className="block h-1" />
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <Link href={href} className="flex items-center gap-2.5">
                              {r.glyph ? (
                                <SportDisciplineGlyph glyph={r.glyph} className="h-7 w-7 shrink-0 text-gray-200" />
                              ) : (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-gray-500">
                                  <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-gray-100">{r.title}</span>
                                <span className="block truncate text-[0.7rem] text-gray-500">{r.sportLabel}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-mono tabular-nums text-gray-300">
                            {r.minutes > 0 ? `${r.minutes}′` : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-mono tabular-nums text-gray-300">
                            {r.load > 0 ? r.load : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle">
                            {r.done ? (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[0.62rem] font-semibold text-emerald-300">
                                Svolto
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.62rem] font-semibold text-gray-400">
                                Da fare
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right align-middle">
                            <Link href={href} aria-label={`Apri seduta del ${r.dayKey}`}>
                              <CalendarDays className="h-4 w-4 text-gray-600 transition-colors group-hover:text-sky-300" aria-hidden />
                            </Link>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: stessa tabella come lista di card verticali (stessi concetti). */}
            <ul className="divide-y divide-white/[0.06] md:hidden">
              {rows.map((r, idx) => {
                const href = productHrefForPathname(`/training/session/${r.dayKey}`, pathname);
                return (
                  <li key={`m-${r.dayKey}-${idx}`} className={r.isToday ? "bg-sky-500/[0.06]" : ""}>
                    {r.monthHeader ? (
                      <div className="bg-white/[0.03] px-3 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.2em] text-sky-300/80">
                        {r.monthHeader}
                      </div>
                    ) : null}
                    <Link href={href} className="flex items-center gap-3 px-3 py-3">
                      <span
                        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${
                          r.isToday ? "border-sky-400/50 bg-sky-500/15 text-sky-100" : "border-white/10 bg-black/30 text-gray-300"
                        }`}
                      >
                        <span className="text-sm font-bold leading-none">{r.dayNumber}</span>
                        <span className="text-[0.5rem] uppercase leading-none text-gray-500">{r.monthShort}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[0.65rem] font-semibold text-gray-300">{r.weekdayLabel}</span>
                          {r.isToday ? (
                            <span className="text-[0.55rem] font-bold uppercase tracking-wide text-sky-300">Oggi</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          {r.glyph ? (
                            <SportDisciplineGlyph glyph={r.glyph} className="h-5 w-5 shrink-0 text-gray-200" />
                          ) : (
                            <Dumbbell className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                          )}
                          <span className="truncate font-semibold text-gray-100">{r.title}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.68rem] text-gray-500">
                          {r.minutes > 0 ? <span className="font-mono tabular-nums">{r.minutes}′</span> : null}
                          {r.load > 0 ? <span className="font-mono tabular-nums">TSS {r.load}</span> : null}
                          <span className={r.done ? "text-emerald-300" : "text-gray-400"}>{r.done ? "Svolto" : "Da fare"}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {err ? (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</p>
      ) : null}
    </Pro2ModulePageShell>
  );
}
