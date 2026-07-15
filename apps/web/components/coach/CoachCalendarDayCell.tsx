"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import { plannedCalendarChipViewModel, type PlannedWorkoutFamily } from "@/lib/training/planned-workout-display";
import {
  coachCalendarRowToPlannedWorkout,
  type CoachCalendarPlannedRow,
} from "@/modules/training/services/use-coach-calendar-week";

/** Massimo chip mostrati per banda; oltre → riga "+N". */
const MAX_CHIPS_PER_CELL = 3;

const FAMILY_CHIP_TONE: Record<PlannedWorkoutFamily, string> = {
  strength: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
  aerobic: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  technical: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  lifestyle: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  unknown: "border-white/15 bg-white/5 text-gray-200",
};

/**
 * Cella giorno (atleta × data) della griglia calendario coach — SOLA LETTURA. Due bande
 * verticali: «Pianificato» (chip planned, view-model condiviso col calendario atleta) ed
 * «Eseguito» (sedute reali, anche NON programmate → badge). Placeholder neutro se entrambe vuote.
 * Nessun drop-target/scrittura in questo incremento.
 */
export function CoachCalendarDayCell({
  rows,
  executed,
  athleteId,
  dayIso,
  onOpenExecuted,
  emptyHint,
  moreLabel,
  plannedBandLabel,
  executedBandLabel,
  unplannedBadge,
  athleteFtpWatts,
}: {
  rows: CoachCalendarPlannedRow[];
  /** Sedute eseguite del giorno (contratto dominio). */
  executed?: ExecutedWorkout[];
  athleteId?: string;
  dayIso?: string;
  /** Apre l'analisi di una seduta eseguita. */
  onOpenExecuted?: (exec: ExecutedWorkout, athleteId: string, dayIso: string) => void;
  /** Testo screen-reader/placeholder per la cella vuota (già tradotto). */
  emptyHint: string;
  /** Funzione copia "+N" (già tradotta) per gli extra oltre il limite. */
  moreLabel: (count: number) => string;
  /** Etichetta banda «Pianificato» (già tradotta). */
  plannedBandLabel: string;
  /** Etichetta banda «Eseguito» (già tradotta). */
  executedBandLabel: string;
  /** Badge «non programmato» (già tradotto). */
  unplannedBadge: string;
  athleteFtpWatts?: number | null;
}) {
  const executedRows = executed ?? [];
  const hasPlanned = rows.length > 0;
  const hasExecuted = executedRows.length > 0;

  if (!hasPlanned && !hasExecuted) {
    return (
      <div className="flex min-h-[132px] items-center justify-center rounded-lg border border-dashed border-white/8 bg-white/[0.015] p-1">
        <span className="text-[0.7rem] text-gray-700" aria-label={emptyHint}>
          ·
        </span>
      </div>
    );
  }

  const visiblePlanned = rows.slice(0, MAX_CHIPS_PER_CELL);
  const extraPlanned = rows.length - visiblePlanned.length;
  const visibleExecuted = executedRows.slice(0, MAX_CHIPS_PER_CELL);
  const extraExecuted = executedRows.length - visibleExecuted.length;

  return (
    <div className="flex min-h-[132px] flex-col gap-1.5 rounded-lg border border-white/10 bg-black/25 p-1.5">
      {/* Banda PIANIFICATO */}
      <div className="flex flex-col gap-1">
        <span className="px-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-gray-500">
          {plannedBandLabel}
        </span>
        {hasPlanned ? (
          <>
            {visiblePlanned.map((row, idx) => {
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
            {extraPlanned > 0 ? (
              <div className="px-1 text-[0.6rem] font-semibold text-gray-400">{moreLabel(extraPlanned)}</div>
            ) : null}
          </>
        ) : (
          <span className="px-0.5 text-[0.7rem] text-gray-700" aria-hidden>
            ·
          </span>
        )}
      </div>

      {/* Banda ESEGUITO */}
      <div className="flex flex-col gap-1 border-t border-white/5 pt-1">
        <span className="px-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-emerald-500/70">
          {executedBandLabel}
        </span>
        {hasExecuted ? (
          <>
            {visibleExecuted.map((exec, idx) => {
              const unplanned = !exec.plannedWorkoutId;
              const clickable = Boolean(onOpenExecuted && athleteId && dayIso);
              return (
                <button
                  key={exec.id ?? `${exec.date}-exec-${idx}`}
                  type="button"
                  disabled={!clickable}
                  onClick={
                    clickable ? () => onOpenExecuted!(exec, athleteId as string, dayIso as string) : undefined
                  }
                  className="flex w-full flex-col gap-0.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-1 text-left text-emerald-100 transition enabled:hover:border-emerald-300/50 enabled:hover:bg-emerald-500/20 disabled:cursor-default"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[0.65rem] font-medium tabular-nums">
                      {Math.round(exec.durationMinutes)}m · {LOAD_CHIP_LABEL} {Math.round(exec.tss)}
                    </span>
                    {unplanned ? (
                      <span className="shrink-0 rounded-sm bg-emerald-400/20 px-1 py-px text-[0.5rem] font-bold uppercase tracking-wide text-emerald-200">
                        {unplannedBadge}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
            {extraExecuted > 0 ? (
              <div className="px-1 text-[0.6rem] font-semibold text-gray-400">{moreLabel(extraExecuted)}</div>
            ) : null}
          </>
        ) : (
          <span className="px-0.5 text-[0.7rem] text-gray-700" aria-hidden>
            ·
          </span>
        )}
      </div>
    </div>
  );
}
