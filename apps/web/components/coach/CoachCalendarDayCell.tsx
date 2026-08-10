"use client";

import { useState, type DragEvent } from "react";
import type { ExecutedWorkout } from "@empathy/domain-training";
import { ClipboardPaste, Copy, Pencil, Trash2 } from "lucide-react";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import { plannedCalendarChipViewModel, type PlannedWorkoutFamily } from "@/lib/training/planned-workout-display";
import {
  coachCalendarRowToPlannedWorkout,
  type CoachCalendarPlannedRow,
} from "@/modules/training/services/use-coach-calendar-week";
import {
  COACH_CALENDAR_DRAG_MIME,
  decodeCoachCalendarDragPayload,
  type CoachCalendarDragPayload,
} from "@/lib/training/library/coach-calendar-drag-payload";

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
 * Cella giorno (atleta × data) della griglia calendario coach. Due bande verticali:
 * «Pianificato» (chip planned, view-model condiviso col calendario atleta) ed «Eseguito»
 * (sedute reali, anche NON programmate → badge). Placeholder neutro se entrambe vuote.
 *
 * Due vie di assegnazione, entrambe attive: drop di una card sorgente (mouse) e click sul
 * bottone di assegnazione quando la board ha una seduta «in mano» (funziona anche da tablet,
 * dove il drag HTML5 non parte). Le metriche sono compattate perché con la settimana intera a
 * vista la colonna giorno scende a ~108px: il testo esteso finirebbe a capo.
 */
export function CoachCalendarDayCell({
  rows,
  executed,
  athleteId,
  dayIso,
  onOpenExecuted,
  onEditPlanned,
  onCopyPlanned,
  onDeletePlanned,
  onAssignInto,
  assignActive,
  assignBusy,
  deleteBusy,
  onDropSession,
  editActionLabel,
  copyActionLabel,
  deleteActionLabel,
  assignHereLabel,
  emptyHint,
  dropHint,
  moreLabel,
  plannedBandLabel,
  executedBandLabel,
  unplannedBadge,
  unplannedBadgeShort,
  athleteFtpWatts,
}: {
  rows: CoachCalendarPlannedRow[];
  /** Sedute eseguite del giorno (contratto dominio). */
  executed?: ExecutedWorkout[];
  athleteId?: string;
  dayIso?: string;
  /** Apre l'analisi di una seduta eseguita. */
  onOpenExecuted?: (exec: ExecutedWorkout, athleteId: string, dayIso: string) => void;
  /** Apre il popup «Modifica seduta pianificata» su una riga planned. */
  onEditPlanned?: (row: CoachCalendarPlannedRow, athleteId: string) => void;
  /** Mette una riga planned «in mano» alla board (poi si assegna cliccando un giorno). */
  onCopyPlanned?: (row: CoachCalendarPlannedRow, athleteId: string) => void;
  /** Elimina la seduta pianificata. La CONFERMA vive a monte (board): è distruttiva. */
  onDeletePlanned?: (row: CoachCalendarPlannedRow, athleteId: string) => void;
  /** Assegna la seduta «in mano» della board a questa cella (atleta × giorno). */
  onAssignInto?: (athleteId: string, dateIso: string) => void;
  /** True quando la board ha una seduta «in mano»: mostra il bottone di assegnazione. */
  assignActive?: boolean;
  /** True durante un'assegnazione in corso (disabilita i bottoni). */
  assignBusy?: boolean;
  /** True durante un'eliminazione in corso (disabilita i cestini della griglia). */
  deleteBusy?: boolean;
  /** Drop di una card libreria/preset sulla cella → assegna la seduta all'atleta in quella data. */
  onDropSession?: (input: { payload: CoachCalendarDragPayload; athleteId: string; dateIso: string }) => void;
  /** aria-label «Modifica seduta» (già tradotto). */
  editActionLabel?: string;
  /** aria-label «Copia seduta» (già tradotto). */
  copyActionLabel?: string;
  /** aria-label «Elimina seduta» (già tradotto). */
  deleteActionLabel?: string;
  /** Etichetta bottone assegnazione: «Incolla qui» o «Assegna qui» (già tradotto). */
  assignHereLabel?: string;
  /** Testo screen-reader/placeholder per la cella vuota (già tradotto). */
  emptyHint: string;
  /** Suggerimento drop «Rilascia per assegnare» (già tradotto). */
  dropHint?: string;
  /** Funzione copia "+N" (già tradotta) per gli extra oltre il limite. */
  moreLabel: (count: number) => string;
  /** Etichetta banda «Pianificato» (già tradotta). */
  plannedBandLabel: string;
  /** Etichetta banda «Eseguito» (già tradotta). */
  executedBandLabel: string;
  /** Badge «non programmato» esteso, usato nel `title` (già tradotto). */
  unplannedBadge: string;
  /** Badge «non programmato» compatto mostrato nel chip (già tradotto). */
  unplannedBadgeShort?: string;
  athleteFtpWatts?: number | null;
}) {
  const executedRows = executed ?? [];
  const hasPlanned = rows.length > 0;
  const hasExecuted = executedRows.length > 0;

  const [dragOver, setDragOver] = useState(false);
  const canDrop = Boolean(onDropSession && athleteId && dayIso);
  const canAssign = Boolean(assignActive && onAssignInto && athleteId && dayIso);

  const assignButton = canAssign ? (
    <button
      type="button"
      disabled={assignBusy}
      onClick={() => onAssignInto!(athleteId as string, dayIso as string)}
      className="flex w-full items-center justify-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-1.5 py-1 text-[0.6rem] font-semibold text-cyan-100 transition enabled:hover:border-cyan-300/60 enabled:hover:bg-cyan-500/20 disabled:cursor-default disabled:opacity-50"
    >
      <ClipboardPaste className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{assignHereLabel}</span>
    </button>
  ) : null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop) return;
    if (!e.dataTransfer.types.includes(COACH_CALENDAR_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragOver) setDragOver(true);
  };
  const handleDragLeave = () => {
    if (dragOver) setDragOver(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop) return;
    e.preventDefault();
    setDragOver(false);
    const payload = decodeCoachCalendarDragPayload(e.dataTransfer.getData(COACH_CALENDAR_DRAG_MIME));
    if (payload) onDropSession!({ payload, athleteId: athleteId as string, dateIso: dayIso as string });
  };

  if (!hasPlanned && !hasExecuted) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex min-h-[132px] items-center justify-center rounded-lg border border-dashed p-1 transition ${
          dragOver
            ? "border-cyan-400/60 bg-cyan-500/10 ring-1 ring-cyan-400/40"
            : canAssign
              ? "border-cyan-400/30 bg-cyan-500/[0.04]"
              : "border-white/8 bg-white/[0.015]"
        }`}
      >
        {dragOver && dropHint ? (
          <span className="text-center text-[0.6rem] font-semibold text-cyan-200">{dropHint}</span>
        ) : canAssign ? (
          assignButton
        ) : (
          <span className="text-[0.7rem] text-gray-700" aria-label={emptyHint}>
            ·
          </span>
        )}
      </div>
    );
  }

  const visiblePlanned = rows.slice(0, MAX_CHIPS_PER_CELL);
  const extraPlanned = rows.length - visiblePlanned.length;
  const visibleExecuted = executedRows.slice(0, MAX_CHIPS_PER_CELL);
  const extraExecuted = executedRows.length - visibleExecuted.length;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex min-h-[132px] min-w-0 flex-col gap-1.5 rounded-lg border p-1.5 transition ${
        dragOver
          ? "border-cyan-400/60 bg-cyan-500/10 ring-1 ring-cyan-400/40"
          : canAssign
            ? "border-cyan-400/30 bg-black/25"
            : "border-white/10 bg-black/25"
      }`}
    >
      {canAssign ? assignButton : null}

      {/* Banda PIANIFICATO */}
      <div className="flex flex-col gap-1">
        <span className="px-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-gray-500">
          {plannedBandLabel}
        </span>
        {hasPlanned ? (
          <>
            {visiblePlanned.map((row, idx) => {
              const chip = plannedCalendarChipViewModel(coachCalendarRowToPlannedWorkout(row), { athleteFtpWatts });
              const canEdit = Boolean(onEditPlanned && athleteId && row.id);
              const canCopy = Boolean(onCopyPlanned && athleteId && row.id);
              const canDelete = Boolean(onDeletePlanned && athleteId && row.id);
              return (
                <div
                  key={row.id ?? `${row.date}-${idx}`}
                  className={`flex min-w-0 flex-col gap-0.5 rounded-md border px-1.5 py-1 ${FAMILY_CHIP_TONE[chip.family]}`}
                  /* Il carico esteso vive QUI: nella riga metrica «Carico» è tagliato per
                     stare nei ~86px utili della colonna giorno stretta. */
                  title={`${chip.detailLine} · ${chip.minutes}m · ${LOAD_CHIP_LABEL} ${chip.load}`}
                >
                  <div className="flex min-w-0 items-center gap-1">
                    {chip.glyph ? <SportDisciplineGlyph glyph={chip.glyph} className="h-3.5 w-3.5 shrink-0" /> : null}
                    <span className="truncate text-[0.65rem] font-bold uppercase tracking-wide">{chip.sportLabel}</span>
                    {canCopy || canEdit || canDelete ? (
                      <div className="ml-auto flex shrink-0 items-center gap-0.5">
                        {canCopy ? (
                          <button
                            type="button"
                            onClick={() => onCopyPlanned!(row, athleteId as string)}
                            aria-label={copyActionLabel}
                            title={copyActionLabel}
                            className="flex h-4 w-4 items-center justify-center rounded text-current opacity-60 transition hover:opacity-100"
                          >
                            <Copy className="h-3 w-3" aria-hidden />
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => onEditPlanned!(row, athleteId as string)}
                            aria-label={editActionLabel}
                            title={editActionLabel}
                            className="flex h-4 w-4 items-center justify-center rounded text-current opacity-60 transition hover:opacity-100"
                          >
                            <Pencil className="h-3 w-3" aria-hidden />
                          </button>
                        ) : null}
                        {/* ELIMINA per ultimo (dopo copia/modifica): l'azione distruttiva sta
                            lontano da quelle innocue. La conferma è a monte, nella board. */}
                        {canDelete ? (
                          <button
                            type="button"
                            disabled={deleteBusy}
                            onClick={() => onDeletePlanned!(row, athleteId as string)}
                            aria-label={deleteActionLabel}
                            title={deleteActionLabel}
                            className="flex h-4 w-4 items-center justify-center rounded text-current opacity-60 transition enabled:hover:text-rose-200 enabled:hover:opacity-100 disabled:cursor-default disabled:opacity-30"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 truncate text-[0.65rem] font-medium tabular-nums opacity-90">
                    {chip.minutes}m · {chip.load}
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
                  className="flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-1 text-left text-emerald-100 transition enabled:hover:border-emerald-300/50 enabled:hover:bg-emerald-500/20 disabled:cursor-default"
                  title={`${Math.round(exec.durationMinutes)}m · ${LOAD_CHIP_LABEL} ${Math.round(exec.tss)}${
                    unplanned ? ` · ${unplannedBadge}` : ""
                  }`}
                >
                  {/* gap-0.5 e badge px-0.5: nei ~74px interni del chip a 1280px, con gap-1 e
                      px-1 la riga metrica veniva tagliata di 2-3px (il carico spariva). */}
                  <div className="flex min-w-0 items-center justify-between gap-0.5">
                    <span className="min-w-0 truncate text-[0.65rem] font-medium tabular-nums">
                      {Math.round(exec.durationMinutes)}m · {Math.round(exec.tss)}
                    </span>
                    {unplanned ? (
                      /* Badge COMPATTO: «non programmato» per esteso occupa da solo più della
                         colonna. Il testo intero resta nel `title` del chip. */
                      <span
                        aria-label={unplannedBadge}
                        className="shrink-0 rounded-sm border border-amber-400/50 bg-amber-500/30 px-0.5 py-px text-[0.5rem] font-bold uppercase tracking-wide text-amber-100"
                      >
                        {unplannedBadgeShort ?? unplannedBadge}
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
