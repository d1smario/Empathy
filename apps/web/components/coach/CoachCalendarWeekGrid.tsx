"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { CopyPlus, X } from "lucide-react";
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
 * Griglia settimana × atleti: header 7 giorni, prima colonna sticky col nome atleta, una riga
 * per atleta con 7 celle giorno. Con le tracce strette la settimana intera entra senza scroll
 * orizzontale da 1280px in su; sotto (tablet/telefono) si scorre — UNA vista responsive
 * (stessa struttura desktop/mobile, cambia solo il viewport).
 */
export function CoachCalendarWeekGrid({
  athletes,
  days,
  cells,
  executedCells,
  onOpenExecuted,
  onEditPlanned,
  onCopyPlanned,
  onAssignInto,
  onCopyWeek,
  copyWeekSource,
  onRunCopyWeek,
  onCancelCopyWeek,
  assignActive,
  assignBusy,
  assignHereLabel,
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
  /** Mette una riga planned «in mano» alla board (poi si assegna cliccando un giorno). */
  onCopyPlanned?: (row: CoachCalendarPlannedRow, athleteId: string) => void;
  /** Assegna la seduta «in mano» (copia o sorgente) a una cella (atleta × giorno). */
  onAssignInto?: (athleteId: string, dateIso: string) => void;
  /** Copia l'intera settimana dell'atleta sorgente su un altro atleta. */
  onCopyWeek?: (sourceAthleteId: string) => void;
  /** Atleta sorgente col picker «Copia settimana» aperto (null = nessun popover). */
  copyWeekSource?: string | null;
  /** Conferma la copia settimana sorgente→destinazione (chiude il popover a fine run). */
  onRunCopyWeek?: (sourceAthleteId: string, destAthleteId: string) => void;
  /** Chiude il picker «Copia settimana» senza copiare. */
  onCancelCopyWeek?: () => void;
  /** True quando la «mano» è piena: abilita il bottone di assegnazione in ogni cella. */
  assignActive?: boolean;
  /** True durante un'assegnazione in corso. */
  assignBusy?: boolean;
  /** Etichetta del bottone cella: «Incolla qui» (copia) o «Assegna qui» (sorgente). */
  assignHereLabel?: string;
  /** True durante una copia settimana in corso (disabilita i trigger). */
  copyWeekBusy?: boolean;
  /** Drop di una card libreria/preset su una cella → assegna la seduta all'atleta in quella data. */
  onDropSession?: (input: { payload: CoachCalendarDragPayload; athleteId: string; dateIso: string }) => void;
  athleteFtpWatts?: number | null;
}) {
  const t = useTranslations("CoachCalendarBoard");
  // Tracce STRETTE: senza l'aside di 18rem i 7 giorni entrano tutti da 1280px in su e lo
  // scroll orizzontale sparisce. I minimi (7rem + 7×6.5rem) sono il pavimento per tablet.
  const gridTemplate = { gridTemplateColumns: `minmax(7rem, 11rem) repeat(${days.length}, minmax(6.5rem, 1fr))` };

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="min-w-[53rem]">
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
            {/* z-30 quando il popover «Copia settimana» è aperto: la cella sticky delle righe
                successive (z-10, sfondo quasi opaco) altrimenti lo coprirebbe. */}
            <div
              className={`sticky left-0 flex min-w-0 flex-col justify-center gap-1 border-r border-white/10 bg-zinc-950/95 px-3 py-2 ${
                copyWeekSource === athlete.id ? "z-30" : "z-10"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{formatAthleteLabel(athlete)}</p>
                {athlete.email ? <p className="truncate text-[0.7rem] text-gray-500">{athlete.email}</p> : null}
              </div>
              {onCopyWeek ? (
                <CopyWeekTrigger
                  athleteId={athlete.id}
                  athletes={athletes}
                  open={copyWeekSource === athlete.id}
                  busy={copyWeekBusy}
                  onOpen={onCopyWeek}
                  onCancel={onCancelCopyWeek}
                  onPick={onRunCopyWeek}
                />
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
                  onAssignInto={onAssignInto}
                  assignActive={assignActive}
                  assignBusy={assignBusy}
                  onDropSession={onDropSession}
                  editActionLabel={t("editAction")}
                  copyActionLabel={t("copyAction")}
                  assignHereLabel={assignHereLabel ?? t("pasteHere")}
                  emptyHint={t("cellEmpty")}
                  dropHint={t("dropHint")}
                  moreLabel={(count) => t("moreInCell", { count })}
                  plannedBandLabel={t("plannedBand")}
                  executedBandLabel={t("executedBand")}
                  unplannedBadge={t("unplannedBadge")}
                  unplannedBadgeShort={t("unplannedBadgeShort")}
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

/**
 * Trigger «Copia settimana» + popover di scelta atleta destinazione, ancorato al bottone
 * (absolute in wrapper relative): niente elementi in-flow, la board non si sposta di un pixel.
 * Si apre verso destra (la colonna atleta è al bordo sinistro del canvas largo 72rem, quindi
 * non crea mai overflow orizzontale nuovo); stessi controlli della vecchia fascia, nessuna
 * feature nuova. Chiusura su Escape, pointerdown fuori e a fine copia (source azzerato a monte).
 */
function CopyWeekTrigger({
  athleteId,
  athletes,
  open,
  busy,
  onOpen,
  onCancel,
  onPick,
}: {
  athleteId: string;
  athletes: CanonicalAthleteRow[];
  open: boolean;
  busy?: boolean;
  onOpen: (sourceAthleteId: string) => void;
  onCancel?: () => void;
  onPick?: (sourceAthleteId: string, destAthleteId: string) => void;
}) {
  const t = useTranslations("CoachCalendarBoard");
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Escape + pointerdown fuori dal wrapper (bottone incluso) → chiudi. Mai durante la copia:
  // il click fuori non deve aggirare il bottone Annulla disabilitato.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (busy) return;
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) onCancel?.();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, onCancel]);

  // Accessibilità dialog: focus sul primo controllo all'apertura.
  useEffect(() => {
    if (open) popoverRef.current?.querySelector("button")?.focus();
  }, [open]);

  return (
    <div ref={wrapRef} className="relative w-fit">
      <button
        type="button"
        disabled={busy}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? onCancel?.() : onOpen(athleteId))}
        title={t("copyWeekAction")}
        className="flex w-fit items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.6rem] font-semibold text-gray-300 transition enabled:hover:border-white/25 enabled:hover:text-white disabled:cursor-default disabled:opacity-50"
      >
        <CopyPlus className="h-3 w-3" aria-hidden />
        {t("copyWeekAction")}
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t("copyWeekPickTarget")}
          className="absolute left-0 top-full z-30 mt-1.5 w-[21rem] rounded-xl border border-violet-400/30 bg-zinc-950/95 p-3 shadow-xl shadow-black/50 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-violet-100">{t("copyWeekPickTarget")}</p>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-gray-200 transition enabled:hover:border-white/30 enabled:hover:text-white disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t("cancelCopy")}
            </button>
          </div>
          {/* Scroll interno con roster lunghi: il popover non deve crescere oltre la board. */}
          <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
            {athletes
              .filter((a) => a.id !== athleteId)
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick?.(athleteId, a.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-black/25 px-3 py-1.5 text-xs font-medium text-white transition enabled:hover:border-violet-300/60 enabled:hover:bg-violet-500/15 disabled:cursor-default disabled:opacity-50"
                >
                  {t("copyWeekConfirm")} · {formatAthleteLabel(a)}
                </button>
              ))}
          </div>
          {busy ? <p className="mt-2 text-[0.7rem] text-violet-200">{t("assigning")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
