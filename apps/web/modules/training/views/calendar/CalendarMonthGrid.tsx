"use client";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import type { WellnessByDateMap } from "@/lib/physiology/wellness-window-summary";
import { normalizeDateKey, traceRecord } from "@/lib/training/calendar-analyzer-helpers";
import { resolveExecutedTrainingLoad } from "@/lib/training/infer-executed-training-load";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import {
  plannedCalendarChipViewModel,
  uniquePlannedSportGlyphs,
} from "@/lib/training/planned-workout-display";
import {
  PLANNED_DRAG_MIME,
  readPlannedDragPayload,
  type PlannedDragPayload,
} from "./useCalendarMonthData";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickMetric(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const k of keys) {
    const value = num(trace[k]);
    if (value != null) return value;
  }
  return null;
}

function pickText(trace: Record<string, unknown> | null, keys: string[]): string | null {
  if (!trace) return null;
  for (const k of keys) {
    const v = trace[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

function sportIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("run")) return "run";
  if (t.includes("bike") || t.includes("cycl")) return "bike";
  if (t.includes("swim")) return "swim";
  if (t.includes("gym") || t.includes("strength")) return "strength";
  return "generic";
}

/** Stesse icone compatte della calendar V1 (`SportGlyph`). */
function SportGlyph({ type }: { type: string }) {
  const icon = sportIcon(type);
  const common = {
    viewBox: "0 0 24 24",
    width: 14,
    height: 14,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (icon === "run")
    return (
      <svg {...common}>
        <circle cx="17" cy="5" r="2" />
        <path d="M9 18l3-6 2 2 4 2" />
        <path d="M12 11l1-4 4 1" />
        <path d="M6 22l3-5" />
      </svg>
    );
  if (icon === "bike")
    return (
      <svg {...common}>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M6 17l4-6h4l4 6" />
        <path d="M10 11l-2-3" />
      </svg>
    );
  if (icon === "swim")
    return (
      <svg {...common}>
        <path d="M3 15c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0" />
        <path d="M8 10l3-2 3 2" />
        <path d="M12 8V5" />
      </svg>
    );
  if (icon === "strength")
    return (
      <svg {...common}>
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M6 10v4" />
        <path d="M18 10v4" />
        <path d="M8 12h8" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M13 2L3 14h8l-1 8 10-12h-8z" />
    </svg>
  );
}

export interface CalendarMonthGridProps {
  athleteId: string | null;
  athleteFtpWatts: number | null;
  monthStart: Date;
  daysInMonth: number;
  monthStartWeekdayMonday: number;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  plannedByDate: Map<string, PlannedWorkout[]>;
  executedByDate: Map<string, ExecutedWorkout[]>;
  wellnessByDate: WellnessByDateMap;
  dragPlannedId: string | null;
  setDragPlannedId: (id: string | null) => void;
  dropTargetDate: string | null;
  setDropTargetDate: (updater: string | null | ((prev: string | null) => string | null)) => void;
  movePlannedBusyId: string | null;
  movePlannedWorkoutToDate: (workoutId: string, fromDate: string, toDate: string) => Promise<void>;
}

/**
 * Griglia mensile: ogni giorno è una cella con chip PLAN / EXEC e dati minimi.
 * Il click sulla cella seleziona il giorno e scrolla al dettaglio (id storici
 * `calendar-day-planned-detail` / `calendar-day-builder-actions` preservati).
 */
export function CalendarMonthGrid({
  athleteId,
  athleteFtpWatts,
  monthStart,
  daysInMonth,
  monthStartWeekdayMonday,
  selectedDate,
  setSelectedDate,
  plannedByDate,
  executedByDate,
  wellnessByDate,
  dragPlannedId,
  setDragPlannedId,
  dropTargetDate,
  setDropTargetDate,
  movePlannedBusyId,
  movePlannedWorkoutToDate,
}: CalendarMonthGridProps) {
  return (
    <section className="tc2-calendar-shell mb-10 rounded-2xl border border-orange-500/20 bg-gradient-to-b from-black/80 to-black/50 shadow-inner shadow-orange-950/25">
      <div className="tc2-calendar-scroll">
        <div className="tc2-calendar-frame">
          <div className="tc2-calendar-weekdays">
            {WEEKDAYS.map((d) => (
              <div key={d} className="tc2-calendar-weekday-label">
                {d}
              </div>
            ))}
          </div>
          <div className="tc2-calendar-grid">
            {Array.from({ length: monthStartWeekdayMonday }).map((_, i) => (
              <div key={`pad-start-${i}`} className="tc2-calendar-grid-pad" aria-hidden />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const pList = plannedByDate.get(date) ?? [];
              const eList = executedByDate.get(date) ?? [];
              const active = selectedDate === date;
              const hasExecuted = eList.length > 0;
              const wellness = wellnessByDate[date];
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setSelectedDate(date);
                    const target =
                      pList.length > 0
                        ? "calendar-day-planned-detail"
                        : "calendar-day-builder-actions";
                    window.setTimeout(() => {
                      document.getElementById(target)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 60);
                  }}
                  onDragOver={(e) => {
                    if (!readPlannedDragPayload(e.dataTransfer)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTargetDate(date);
                  }}
                  onDragLeave={() => {
                    setDropTargetDate((prev) => (prev === date ? null : prev));
                  }}
                  onDrop={(e) => {
                    const payload = readPlannedDragPayload(e.dataTransfer);
                    if (!payload) return;
                    e.preventDefault();
                    e.stopPropagation();
                    void movePlannedWorkoutToDate(payload.id, payload.fromDate, date);
                  }}
                  className={`tc2-calendar-day ${active ? "tc2-calendar-day--active" : ""} ${
                    dropTargetDate === date ? "tc2-calendar-day--drop-target" : ""
                  }`}
                >
                  <div className="tc2-calendar-day-num flex items-center justify-between gap-1">
                    <span>{day}</span>
                    {hasExecuted ? (
                      <span
                        className="tc2-calendar-exec-dot"
                        title={`${eList.length} executed`}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  {pList.length > 0 ? (
                    <div
                      className="tc2-calendar-day-glyphs flex flex-wrap items-center justify-center gap-0.5 py-0.5"
                      aria-label="Planned sports"
                    >
                      {uniquePlannedSportGlyphs(pList, 5).map((glyph) => (
                        <SportDisciplineGlyph key={glyph} glyph={glyph} className="h-4 w-4 text-orange-200/95" />
                      ))}
                    </div>
                  ) : null}
                  {wellness ? (
                    <div className="tc2-calendar-wellness">
                      {wellness.sleepHours != null ? (
                        <span className="text-sky-200/90">
                          Z {Math.floor(wellness.sleepHours)}h
                          {String(Math.round((wellness.sleepHours - Math.floor(wellness.sleepHours)) * 60)).padStart(2, "0")}
                        </span>
                      ) : null}
                      {wellness.hrvMs != null ? (
                        <span className="text-emerald-200/90">HRV {Math.round(wellness.hrvMs)}</span>
                      ) : null}
                      {wellness.restingHrBpm != null ? (
                        <span className="text-red-200/90">RHR {Math.round(wellness.restingHrBpm)}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {pList.slice(0, 2).map((w) => {
                    const chip = plannedCalendarChipViewModel(w, { athleteFtpWatts });
                    const moving = movePlannedBusyId === w.id;
                    return (
                      <div
                        key={w.id}
                        draggable={!moving && Boolean(athleteId)}
                        onDragStart={(e) => {
                          if (!athleteId || moving) {
                            e.preventDefault();
                            return;
                          }
                          e.stopPropagation();
                          const payload: PlannedDragPayload = {
                            id: w.id,
                            fromDate: normalizeDateKey(w.date) || date,
                          };
                          e.dataTransfer.setData(PLANNED_DRAG_MIME, JSON.stringify(payload));
                          e.dataTransfer.effectAllowed = "move";
                          setDragPlannedId(w.id);
                        }}
                        onDragEnd={() => {
                          setDragPlannedId(null);
                          setDropTargetDate(null);
                        }}
                        className={`tc2-calendar-chip tc2-calendar-chip--draggable ${chip.chipClass} ${
                          dragPlannedId === w.id ? "tc2-calendar-chip--dragging" : ""
                        } ${moving ? "opacity-50" : ""}`}
                        title="Drag to another day of the calendar"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className={`tc2-calendar-chip-icon tc2-calendar-chip-icon--${chip.family}`}>
                            {chip.glyph ? (
                              <SportDisciplineGlyph glyph={chip.glyph} className="h-4 w-4" />
                            ) : (
                              <SportGlyph type={w.type} />
                            )}
                          </span>
                          <span>Planned</span>
                          <span
                            className={`tc2-calendar-chip-sport-badge ${
                              chip.family === "strength"
                                ? "bg-fuchsia-500/30 text-fuchsia-100"
                                : chip.family === "aerobic"
                                  ? "bg-cyan-500/25 text-cyan-100"
                                  : "bg-white/10 text-gray-200"
                            }`}
                          >
                            {chip.sportLabel}
                          </span>
                        </div>
                        <div>
                          {chip.minutes}m · {LOAD_CHIP_LABEL} {chip.load}
                        </div>
                        <div className="opacity-90">{chip.detailLine}</div>
                      </div>
                    );
                  })}
                  {pList.length > 2 ? (
                    <div className="text-[10px] font-semibold text-orange-200/90">+{pList.length - 2} planned</div>
                  ) : null}
                  {eList.slice(0, 2).map((w) => {
                    const tr = traceRecord(w);
                    const km = pickMetric(tr, ["distance_km", "distanceKm", "km"]);
                    const pwr = pickMetric(tr, ["power_avg_w", "power_avg", "avg_power", "powerAvg", "avgPower"]);
                    const importedFile = pickText(tr, ["imported_file_name"]);
                    return (
                      <div key={w.id} className="tc2-calendar-chip tc2-calendar-chip-exec">
                        <div className="font-bold">✅ Executed</div>
                        <div>
                          {w.durationMinutes}m · {LOAD_CHIP_LABEL}{" "}
                          {resolveExecutedTrainingLoad({
                            storedTss: w.tss,
                            durationMinutes: w.durationMinutes,
                            traceSummary: tr,
                          }).toFixed(0)}
                        </div>
                        <div>
                          km {km != null ? km.toFixed(1) : "—"} · Pavg {pwr != null ? Math.round(pwr) : "—"} · kcal{" "}
                          {w.kcal != null ? Number(w.kcal).toFixed(0) : "—"}
                        </div>
                        {importedFile ? (
                          <div className="mt-0.5 opacity-90">
                            file: {importedFile.slice(0, 40)}
                            {importedFile.length > 40 ? "…" : ""}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {eList.length > 2 ? (
                    <div className="text-[10px] font-semibold text-gray-300">+{eList.length - 2} executed</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
