"use client";

import { useTranslations } from "next-intl";
import { CopyPlus } from "lucide-react";
import type { ExecutedWorkout } from "@empathy/domain-training";
import type { CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import { formatAthleteLabel } from "@/lib/coach/use-coach-roster";
import { CoachCalendarDayCell } from "@/components/coach/CoachCalendarDayCell";
import {
  coachCalendarCellKey,
  type CoachCalendarPlannedRow,
} from "@/modules/training/services/use-coach-calendar-week";
import type { CoachCalendarDragPayload } from "@/lib/training/library/coach-calendar-drag-payload";

export type CoachCalendarDay = {
  /** Giorno ISO `YYYY-MM-DD`. */
  iso: string;
  /** Etichetta giorno breve, già localizzata (es. "lun"). */
  label: string;
  /** Numero del giorno del mese. */
  dayNum: string;
  /** True se il giorno è oggi (evidenziazione colonna). */
  isToday: boolean;
};

/**
 * Griglia settimana × atleti (sola lettura): header 7 giorni, prima colonna sticky col nome
 * atleta, una riga per atleta con 7 celle giorno. I giorni scorrono orizzontalmente, gli atleti
 * verticalmente — UNA vista responsive (stessa struttura desktop/mobile, cambia solo il viewport).
 */
export function CoachCalendarWeekGrid({
  athletes,
  days,
  cells,
  executedCells,
  onOpenExecuted,
  onEditPlanned,
  onCopyPlanned,
  onPasteInto,
  onCopyWeek,
  pasteActive,
  pasteBusy,
  copyWeekBusy,
  onDropSession,
  athleteFtpWatts,
}: {
  athletes: CanonicalAthleteRow[];
  days: CoachCalendarDay[];
  cells: Map<string, CoachCalendarPlannedRow[]>;
  /** Sedute ESEGUITE per cella `${athleteId}|${giorno}` (banda «Eseguito»). */
  executedCells?: Map<string, ExecutedWorkout[]>;
  /** Apre l'analisi di una seduta eseguita cliccata. */
  onOpenExecuted?: (exec: ExecutedWorkout, athleteId: string, dayIso: string) => void;
  /** Apre il popup «Modifica seduta pianificata» su una riga planned. */
  onEditPlanned?: (row: CoachCalendarPlannedRow, athleteId: string) => void;
  /** Copia una riga planned nella clipboard in-memory della board. */
  onCopyPlanned?: (row: CoachCalendarPlannedRow, athleteId: string) => void;
  /** Incolla la seduta in clipboard su una cella (atleta × giorno). */
  onPasteInto?: (athleteId: string, dateIso: string) => void;
  /** Copia l'intera settimana dell'atleta sorgente su un altro atleta. */
  onCopyWeek?: (sourceAthleteId: string) => void;
  /** True quando la clipboard è piena: abilita i bottoni «Incolla qui». */
  pasteActive?: boolean;
  /** True durante un incolla in corso. */
  pasteBusy?: boolean;
  /** True durante una copia settimana in corso (disabilita i trigger). */
  copyWeekBusy?: boolean;
  /** Drop di una card libreria/preset su una cella → assegna la seduta all'atleta in quella data. */
  onDropSession?: (input: { payload: CoachCalendarDragPayload; athleteId: string; dateIso: string }) => void;
  athleteFtpWatts?: number | null;
}) {
  const t = useTranslations("CoachCalendarBoard");
  const gridTemplate = { gridTemplateColumns: `minmax(9rem, 12rem) repeat(${days.length}, minmax(12rem, 1fr))` };

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="min-w-[72rem]">
        {/* Header giorni: sticky in alto; prima colonna sticky a sinistra (angolo). */}
        <div className="sticky top-0 z-20 grid border-b border-white/10 bg-zinc-950/95 backdrop-blur" style={gridTemplate}>
          <div className="sticky left-0 z-10 flex items-center border-r border-white/10 bg-zinc-950/95 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">
            {t("athleteColumn")}
          </div>
          {days.map((day) => (
            <div
              key={day.iso}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 text-center ${
                day.isToday ? "bg-cyan-500/10" : ""
              }`}
            >
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-gray-500">{day.label}</span>
              <span className={`text-sm font-bold tabular-nums ${day.isToday ? "text-cyan-200" : "text-gray-300"}`}>
                {day.dayNum}
              </span>
            </div>
          ))}
        </div>

        {/* Una riga per atleta. */}
        {athletes.map((athlete) => (
          <div key={athlete.id} className="grid border-b border-white/5 last:border-b-0" style={gridTemplate}>
            <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center gap-1 border-r border-white/10 bg-zinc-950/95 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{formatAthleteLabel(athlete)}</p>
                {athlete.email ? <p className="truncate text-[0.7rem] text-gray-500">{athlete.email}</p> : null}
              </div>
              {onCopyWeek ? (
                <button
                  type="button"
                  disabled={copyWeekBusy}
                  onClick={() => onCopyWeek(athlete.id)}
                  title={t("copyWeekAction")}
                  className="flex w-fit items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.6rem] font-semibold text-gray-300 transition enabled:hover:border-white/25 enabled:hover:text-white disabled:cursor-default disabled:opacity-50"
                >
                  <CopyPlus className="h-3 w-3" aria-hidden />
                  {t("copyWeekAction")}
                </button>
              ) : null}
            </div>
            {days.map((day) => (
              <div key={`${athlete.id}-${day.iso}`} className={`p-1 ${day.isToday ? "bg-cyan-500/5" : ""}`}>
                <CoachCalendarDayCell
                  rows={cells.get(coachCalendarCellKey(athlete.id, day.iso)) ?? []}
                  executed={executedCells?.get(coachCalendarCellKey(athlete.id, day.iso)) ?? []}
                  athleteId={athlete.id}
                  dayIso={day.iso}
                  onOpenExecuted={onOpenExecuted}
                  onEditPlanned={onEditPlanned}
                  onCopyPlanned={onCopyPlanned}
                  onPasteInto={onPasteInto}
                  pasteActive={pasteActive}
                  pasteBusy={pasteBusy}
                  onDropSession={onDropSession}
                  editActionLabel={t("editAction")}
                  copyActionLabel={t("copyAction")}
                  pasteHereLabel={t("pasteHere")}
                  emptyHint={t("cellEmpty")}
                  dropHint={t("dropHint")}
                  moreLabel={(count) => t("moreInCell", { count })}
                  plannedBandLabel={t("plannedBand")}
                  executedBandLabel={t("executedBand")}
                  unplannedBadge={t("unplannedBadge")}
                  athleteFtpWatts={athleteFtpWatts}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
