"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { productHrefForPathname, useIsMobileApp } from "@/lib/shell/use-product-href";
import { plannedCalendarChipViewModel } from "@/lib/training/planned-workout-display";
import { useCalendarMonthData } from "./useCalendarMonthData";

/** YYYY-MM-DD locale (stessa convenzione dei dayKey del calendario). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTH_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

type TableRow = {
  dayKey: string;
  isToday: boolean;
  weekdayLabel: string;
  dayNumber: string;
  monthShort: string;
  /** Prima riga del giorno: mostra l'intestazione data; le successive no. */
  firstOfDay: boolean;
  glyph: ReturnType<typeof plannedCalendarChipViewModel>["glyph"] | null;
  sportLabel: string;
  title: string;
  minutes: number;
  load: number;
  done: boolean;
  planned: boolean;
};

/**
 * Vista TABELLA del calendario Allenamento (2026-07): al posto della griglia
 * mese, un elenco «oggi faccio questo» — una riga per attività, raggruppata per
 * giorno. Clic sulla riga → dettaglio seduta live (`/training/session/{date}`).
 * Riusa lo stesso hook dati della griglia (planned/executed window), zero nuove API.
 */
export default function TrainingCalendarTableView() {
  const cal = useCalendarMonthData();
  const pathname = usePathname() ?? "/";
  const isMobileApp = useIsMobileApp();
  const t = useTranslations("TrainingCalendarPageView");
  const todayKey = localDayKey(new Date());

  const rows = useMemo<TableRow[]>(() => {
    const dayKeys = new Set<string>();
    for (const k of cal.plannedByDate.keys()) if (k >= cal.monthFrom && k <= cal.monthTo) dayKeys.add(k);
    for (const k of cal.executedByDate.keys()) if (k >= cal.monthFrom && k <= cal.monthTo) dayKeys.add(k);
    const sorted = [...dayKeys].sort();

    const out: TableRow[] = [];
    for (const dayKey of sorted) {
      const [y, m, d] = dayKey.split("-").map(Number);
      const dateObj = new Date(y!, (m ?? 1) - 1, d ?? 1);
      const dayMeta = {
        dayKey,
        isToday: dayKey === todayKey,
        weekdayLabel: WEEKDAY_IT[dateObj.getDay()]!,
        dayNumber: String(d ?? 1).padStart(2, "0"),
        monthShort: (MONTH_IT[(m ?? 1) - 1] ?? "").slice(0, 3),
      };
      const planned = cal.plannedByDate.get(dayKey) ?? [];
      const executedCount = (cal.executedByDate.get(dayKey) ?? []).length;
      const dayDone = executedCount > 0;

      if (planned.length) {
        planned.forEach((w, i) => {
          const vm = plannedCalendarChipViewModel(w, { athleteFtpWatts: cal.athleteFtpWatts });
          out.push({
            ...dayMeta,
            firstOfDay: i === 0,
            glyph: vm.glyph,
            sportLabel: vm.sportLabel,
            title: vm.title,
            minutes: vm.minutes,
            load: vm.load,
            done: dayDone,
            planned: true,
          });
        });
      } else if (dayDone) {
        // Giorno con seduta svolta ma non pianificata: una riga sintetica.
        out.push({
          ...dayMeta,
          firstOfDay: true,
          glyph: null,
          sportLabel: "Sessione svolta",
          title: executedCount > 1 ? `${executedCount} sedute registrate` : "Seduta registrata",
          minutes: 0,
          load: 0,
          done: true,
          planned: false,
        });
      }
    }
    return out;
  }, [cal.plannedByDate, cal.executedByDate, cal.monthFrom, cal.monthTo, cal.athleteFtpWatts, todayKey]);

  const monthTitle = `${MONTH_IT[cal.monthCursor.getMonth()]} ${cal.monthCursor.getFullYear()}`;
  const loadingFirst = cal.loading && !cal.calendarReady && rows.length === 0;

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-orange-400"
      title={t("title")}
      description={t("description")}
    >
      <div
        className={`mb-4${cal.adminScoped ? " pointer-events-none opacity-50" : ""}`}
        title={cal.adminScoped ? t("adminScopedTitle") : undefined}
      >
        {isMobileApp ? null : <TrainingSubnav />}
      </div>

    <div className="space-y-4">
      {/* Testata: mese + navigazione */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <div className="text-sm font-bold capitalize text-white">{monthTitle}</div>
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-gray-500">
              Cosa faccio · clicca per la seduta
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Mese precedente"
            onClick={() => cal.setMonthCursor(new Date(cal.monthCursor.getFullYear(), cal.monthCursor.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={cal.goToToday}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
          >
            Oggi
          </button>
          <button
            type="button"
            aria-label="Mese successivo"
            onClick={() => cal.setMonthCursor(new Date(cal.monthCursor.getFullYear(), cal.monthCursor.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/25 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Tabella attività */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {loadingFirst ? (
          <div className="min-h-[30vh] animate-pulse bg-white/[0.03]" aria-hidden />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <Dumbbell className="h-6 w-6 text-gray-600" aria-hidden />
            <p className="text-sm text-gray-400">Nessuna attività pianificata questo mese.</p>
            <p className="text-xs text-gray-600">Usa i tasti mese per spostarti, oppure «Oggi».</p>
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
                    <tr
                      key={`${r.dayKey}-${idx}`}
                      className={`group border-b border-white/[0.06] transition-colors hover:bg-white/[0.04] ${
                        r.isToday ? "bg-sky-500/[0.06]" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                        {r.firstOfDay ? (
                          <Link href={href} className="flex items-center gap-2">
                            <span
                              className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${
                                r.isToday
                                  ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                                  : "border-white/10 bg-black/30 text-gray-300"
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
                          <ChevronRight className="h-4 w-4 text-gray-600 transition-colors group-hover:text-sky-300" aria-hidden />
                        </Link>
                      </td>
                    </tr>
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
                        <span className={r.done ? "text-emerald-300" : "text-gray-400"}>
                          {r.done ? "Svolto" : "Da fare"}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </div>

      {cal.err ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{cal.err}</p>
      ) : null}
    </div>
    </Pro2ModulePageShell>
  );
}
