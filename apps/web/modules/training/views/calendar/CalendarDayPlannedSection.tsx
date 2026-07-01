"use client";

import type { PlannedWorkout } from "@empathy/domain-training";
import { CalendarDays } from "lucide-react";
import { CalendarPlannedBuilderDetail } from "@/components/training/CalendarPlannedBuilderDetail";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { normalizeDateKey } from "@/lib/training/calendar-analyzer-helpers";
import { plannedCalendarChipViewModel } from "@/lib/training/planned-workout-display";
import { PLANNED_DRAG_MIME, type PlannedDragPayload } from "./useCalendarMonthData";

export interface CalendarDayPlannedSectionProps {
  athleteId: string | null;
  athleteFtpWatts: number | null;
  selectedDate: string;
  dayPlanned: PlannedWorkout[];
  dragPlannedId: string | null;
  setDragPlannedId: (id: string | null) => void;
  setDropTargetDate: (date: string | null) => void;
  movePlannedBusyId: string | null;
  dayDeleteAllBusy: boolean;
  dayDeleteAllConfirm: boolean;
  setDayDeleteAllConfirm: (open: boolean) => void;
  onDeleteAllDay: () => Promise<void>;
  onPlannedDeleted: (removedId?: string | null) => Promise<void>;
  onCalendarMutated: () => Promise<void>;
}

/**
 * Sedute pianificate del giorno selezionato (scheda gym / struttura builder).
 * L'id `calendar-day-planned-detail` è storico: target di scroll da griglia e card Oggi.
 */
export function CalendarDayPlannedSection({
  athleteId,
  athleteFtpWatts,
  selectedDate,
  dayPlanned,
  dragPlannedId,
  setDragPlannedId,
  setDropTargetDate,
  movePlannedBusyId,
  dayDeleteAllBusy,
  dayDeleteAllConfirm,
  setDayDeleteAllConfirm,
  onDeleteAllDay,
  onPlannedDeleted,
  onCalendarMutated,
}: CalendarDayPlannedSectionProps) {
  return (
    <div id="calendar-day-planned-detail" className="mb-8 scroll-mt-24 w-full min-w-0">
      <Pro2SectionCard
        accent="orange"
        title="Planned sessions"
        subtitle={`${selectedDate} · ${dayPlanned.length} on this day — gym card / builder structure`}
        icon={CalendarDays}
      >
        {dayPlanned.length >= 2 && athleteId ? (
          <div className="mb-4 rounded-xl border border-amber-400/35 bg-amber-950/30 px-3 py-3">
            <p className="text-xs leading-relaxed text-amber-100/95">
              On this day there are <strong>{dayPlanned.length}</strong> distinct planned sessions.
              Deleting just one leaves the others visible (it is not an automatic restore).
            </p>
            {dayDeleteAllConfirm ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={dayDeleteAllBusy}
                  className="rounded-full border border-rose-300/50 bg-rose-500/25 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-500/40 disabled:opacity-40"
                  onClick={() => void onDeleteAllDay()}
                >
                  {dayDeleteAllBusy ? "Deleting…" : `Confirm: delete all (${dayPlanned.length})`}
                </button>
                <button
                  type="button"
                  disabled={dayDeleteAllBusy}
                  className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/10"
                  onClick={() => setDayDeleteAllConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-2 rounded-full border border-rose-400/45 bg-rose-500/15 px-2.5 py-1.5 text-xs font-bold text-rose-100 hover:bg-rose-500/25"
                onClick={() => setDayDeleteAllConfirm(true)}
              >
                Delete all sessions on this day
              </button>
            )}
          </div>
        ) : null}
        <ul className="space-y-5">
          {dayPlanned.map((w) => (
            <li key={w.id}>
              <div
                draggable={movePlannedBusyId !== w.id && Boolean(athleteId)}
                onDragStart={(e) => {
                  if (!athleteId || movePlannedBusyId === w.id) {
                    e.preventDefault();
                    return;
                  }
                  const payload: PlannedDragPayload = {
                    id: w.id,
                    fromDate: normalizeDateKey(w.date) || selectedDate,
                  };
                  e.dataTransfer.setData(PLANNED_DRAG_MIME, JSON.stringify(payload));
                  e.dataTransfer.effectAllowed = "move";
                  setDragPlannedId(w.id);
                }}
                onDragEnd={() => {
                  setDragPlannedId(null);
                  setDropTargetDate(null);
                }}
                className={`mb-2 flex cursor-grab flex-wrap items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-xs text-orange-100 active:cursor-grabbing ${
                  dragPlannedId === w.id ? "ring-1 ring-orange-400/60" : ""
                }`}
                title="Drag onto a calendar day above"
              >
                <span aria-hidden className="text-orange-300/80">
                  ⋮⋮
                </span>
                <span className="min-w-0 break-words">
                  Drag onto another day ·{" "}
                  {plannedCalendarChipViewModel(w, { athleteFtpWatts }).sportLabel}
                </span>
              </div>
              <CalendarPlannedBuilderDetail
                workout={w}
                athleteId={athleteId}
                athleteFtpWatts={athleteFtpWatts}
                onDeleted={(removedId) => void onPlannedDeleted(removedId)}
                onCalendarMutated={() => void onCalendarMutated()}
              />
            </li>
          ))}
        </ul>
      </Pro2SectionCard>
    </div>
  );
}
