"use client";

import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import { plannedCalendarChipViewModel, type PlannedWorkoutFamily } from "@/lib/training/planned-workout-display";
import {
  coachCalendarRowToPlannedWorkout,
  type CoachCalendarPlannedRow,
} from "@/modules/training/services/use-coach-calendar-week";

/** Massimo chip mostrati per cella; oltre → riga "+N". */
const MAX_CHIPS_PER_CELL = 3;

const FAMILY_CHIP_TONE: Record<PlannedWorkoutFamily, string> = {
  strength: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
  aerobic: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  technical: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  lifestyle: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  unknown: "border-white/15 bg-white/5 text-gray-200",
};

/**
 * Cella giorno (atleta × data) della griglia calendario coach — SOLA LETTURA.
 * Rende i chip delle planned del giorno (view-model condiviso col calendario atleta) o
 * un placeholder neutro se vuota. Nessun drop-target in questo incremento.
 */
export function CoachCalendarDayCell({
  rows,
  emptyHint,
  moreLabel,
  athleteFtpWatts,
}: {
  rows: CoachCalendarPlannedRow[];
  /** Testo screen-reader/placeholder per la cella vuota (già tradotto). */
  emptyHint: string;
  /** Funzione copia "+N" (già tradotta) per gli extra oltre il limite. */
  moreLabel: (count: number) => string;
  athleteFtpWatts?: number | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[64px] items-center justify-center rounded-lg border border-dashed border-white/8 bg-white/[0.015] p-1">
        <span className="text-[0.7rem] text-gray-700" aria-label={emptyHint}>
          ·
        </span>
      </div>
    );
  }

  const visible = rows.slice(0, MAX_CHIPS_PER_CELL);
  const extra = rows.length - visible.length;

  return (
    <div className="flex min-h-[64px] flex-col gap-1 rounded-lg border border-white/10 bg-black/25 p-1.5">
      {visible.map((row, idx) => {
        const chip = plannedCalendarChipViewModel(coachCalendarRowToPlannedWorkout(row), { athleteFtpWatts });
        return (
          <div
            key={row.id ?? `${row.date}-${idx}`}
            className={`flex flex-col gap-0.5 rounded-md border px-1.5 py-1 ${FAMILY_CHIP_TONE[chip.family]}`}
            title={chip.detailLine}
          >
            <div className="flex items-center gap-1">
              {chip.glyph ? <SportDisciplineGlyph glyph={chip.glyph} className="h-3.5 w-3.5 shrink-0" /> : null}
              <span className="truncate text-[0.65rem] font-bold uppercase tracking-wide">{chip.sportLabel}</span>
            </div>
            <div className="text-[0.65rem] font-medium tabular-nums opacity-90">
              {chip.minutes}m · {LOAD_CHIP_LABEL} {chip.load}
            </div>
          </div>
        );
      })}
      {extra > 0 ? <div className="px-1 text-[0.6rem] font-semibold text-gray-400">{moreLabel(extra)}</div> : null}
    </div>
  );
}
