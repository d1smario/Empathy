"use client";

import { CalendarDaySessionDetail } from "@/components/training/CalendarDaySessionDetail";
import { CalendarDayWellnessDetail } from "@/components/training/CalendarDayWellnessDetail";
import { CoachWorkoutLibraryPanel } from "@/components/training/CoachWorkoutLibraryPanel";
import { TrainingCalendarAnalyzer } from "@/components/training/TrainingCalendarAnalyzer";
import { TrainingPeriodVolumeSummary } from "@/components/training/TrainingPeriodVolumeSummary";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { TrainingViryaActivePlanStrip } from "@/components/training/TrainingViryaActivePlanStrip";
import { Pro2StickyAnchorSubnav } from "@/components/navigation/Pro2StickyAnchorSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Accordion, Pro2Link } from "@/components/ui/empathy";
import { useIsMobileApp } from "@/lib/shell/use-product-href";
import { CalendarDayPlannedSection } from "./calendar/CalendarDayPlannedSection";
import { CalendarEngineDetailsAccordion } from "./calendar/CalendarEngineDetailsAccordion";
import { CalendarFileImportSection } from "./calendar/CalendarFileImportSection";
import { CalendarMonthGrid } from "./calendar/CalendarMonthGrid";
import { CalendarTodayCard } from "./calendar/CalendarTodayCard";
import { useCalendarMonthData } from "./calendar/useCalendarMonthData";

const ANCHOR_ITEMS = [
  { id: "oggi", label: "Oggi" },
  { id: "piano", label: "Piano" },
  { id: "analisi", label: "Analisi" },
];

/**
 * Calendario allenamenti — ordine canone Pro 2:
 * Oggi (lavoro principale, una sola CTA Builder) → selettore mese + griglia →
 * Piano → Analisi (collassate) → avanzate (import, volume) → «Dettagli e motore».
 * Stato/fetch e ref anti-stale vivono in blocco in `useCalendarMonthData`.
 */
export default function TrainingCalendarPageView() {
  const cal = useCalendarMonthData();
  const isMobileApp = useIsMobileApp();

  const dataReady = !cal.ctxLoading && cal.calendarReady && !cal.err;

  return (
    <Pro2ModulePageShell
      eyebrow="Allenamento"
      eyebrowClassName="text-orange-400"
      title="Calendario allenamenti"
      description="Le tue sedute pianificate ed eseguite, giorno per giorno."
      headerActions={
        <Pro2Link
          href="/training"
          variant="ghost"
          className="justify-center border border-orange-500/30 bg-orange-500/10 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
        >
          Hub
        </Pro2Link>
      }
    >
      <div className="scroll-mt-28">
        {isMobileApp ? null : <TrainingSubnav />}
      </div>

      <Pro2StickyAnchorSubnav items={ANCHOR_ITEMS} />

      {cal.success ? (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {cal.success}
        </p>
      ) : null}

      {cal.ctxLoading || (cal.loading && !cal.calendarReady) ? (
        <div className="mb-8 space-y-2">
          <div className="h-3 w-full max-w-2xl animate-pulse rounded-xl bg-orange-500/10" />
          <div className="h-[280px] w-full animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : null}

      {cal.monthRefreshing ? (
        <p className="mb-3 text-xs text-orange-300/90" role="status">
          Aggiornamento calendario…
        </p>
      ) : null}

      {cal.viryaReappearWarning ? (
        <p className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="alert">
          {cal.viryaReappearWarning}
        </p>
      ) : null}

      {(cal.fetchDiag?.executedHiddenByPreference ?? 0) > 0 ? (
        <p className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="status">
          {cal.fetchDiag!.executedHiddenByPreference}{" "}
          {cal.fetchDiag!.executedHiddenByPreference === 1 ? "attività eseguita nascosta" : "attività eseguite nascoste"} dal
          calendario in base alle preferenze sorgente dati.{" "}
          <Pro2Link href="/settings" className="text-amber-50 underline underline-offset-2">
            Apri Impostazioni
          </Pro2Link>{" "}
          per includere altri provider (Garmin, Strava, …).
        </p>
      ) : null}

      {cal.err ? (
        <p className="mb-6 text-sm text-amber-300/90" role="alert">
          {cal.err}
        </p>
      ) : null}

      {cal.dayExecuted.some(
        (w) =>
          (w.durationMinutes ?? 0) <= 0 &&
          typeof w.source === "string" &&
          w.source.startsWith("file_import"),
      ) ? (
        <p className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="status">
          Import FIT su questo giorno salvato come EXEC senza durata (import precedente in modalità «Attività»). Re-importa lo
          stesso file con modalità <strong className="text-amber-50">Auto</strong> (o «Workout pianificato»): crea la riga PLAN
          con grafico a blocchi, durata, TSS e kJ come nel Builder; la riga EXEC vuota viene rimossa in automatico.
        </p>
      ) : null}

      {/* 1 · OGGI — lavoro principale: una sola CTA primaria verso il Builder. */}
      <section id="oggi" className="scroll-mt-28">
        {dataReady ? (
          <CalendarTodayCard
            selectedDate={cal.selectedDate}
            dayPlanned={cal.dayPlanned}
            dayExecuted={cal.dayExecuted}
            builderReplacePlanned={cal.builderReplacePlanned}
          />
        ) : null}
      </section>

      {/* 2 · Selettore di contesto: mese e giorno, prima dei numeri. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/50 text-lg text-white hover:border-orange-400/45"
            onClick={() => cal.setMonthCursor(new Date(cal.monthCursor.getFullYear(), cal.monthCursor.getMonth() - 1, 1))}
            aria-label="Mese precedente"
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center text-base font-bold capitalize text-white">{cal.monthLabel}</span>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/50 text-lg text-white hover:border-orange-400/45"
            onClick={() => cal.setMonthCursor(new Date(cal.monthCursor.getFullYear(), cal.monthCursor.getMonth() + 1, 1))}
            aria-label="Mese successivo"
          >
            ›
          </button>
          <button
            type="button"
            className="ml-1 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
            onClick={cal.goToToday}
          >
            Oggi
          </button>
          <button
            type="button"
            className="ml-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
            onClick={cal.toggleFileImport}
          >
            {cal.showFileImport ? "Chiudi import" : "Importa file"}
          </button>
        </div>
        <div className="rounded-xl border border-orange-500/25 bg-black/35 px-3 py-1.5">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Sessioni in finestra</p>
          <p className="font-mono text-lg font-semibold tabular-nums text-white">{cal.monthlySessionCount}</p>
        </div>
      </div>

      {dataReady ? (
        <CalendarMonthGrid
          athleteId={cal.athleteId}
          athleteFtpWatts={cal.athleteFtpWatts}
          monthStart={cal.monthStart}
          daysInMonth={cal.daysInMonth}
          monthStartWeekdayMonday={cal.monthStartWeekdayMonday}
          selectedDate={cal.selectedDate}
          setSelectedDate={cal.setSelectedDate}
          plannedByDate={cal.plannedByDate}
          executedByDate={cal.executedByDate}
          wellnessByDate={cal.wellnessByDate}
          dragPlannedId={cal.dragPlannedId}
          setDragPlannedId={cal.setDragPlannedId}
          dropTargetDate={cal.dropTargetDate}
          setDropTargetDate={cal.setDropTargetDate}
          movePlannedBusyId={cal.movePlannedBusyId}
          movePlannedWorkoutToDate={cal.movePlannedWorkoutToDate}
        />
      ) : null}

      {/* 3 · PIANO — piano attivo, sedute pianificate del giorno, libreria coach (collassata). */}
      <section id="piano" className="scroll-mt-28">
        {dataReady ? (
          <>
            <TrainingViryaActivePlanStrip
              athleteId={cal.athleteId}
              selectedDate={cal.selectedDate}
              plans={cal.viryaPlans}
              loadErr={cal.viryaPlansLoadErr}
              plansLoading={cal.viryaPlansLoading}
            />
            {cal.dayPlanned.length > 0 ? (
              <CalendarDayPlannedSection
                athleteId={cal.athleteId}
                athleteFtpWatts={cal.athleteFtpWatts}
                selectedDate={cal.selectedDate}
                dayPlanned={cal.dayPlanned}
                dragPlannedId={cal.dragPlannedId}
                setDragPlannedId={cal.setDragPlannedId}
                setDropTargetDate={cal.setDropTargetDate}
                movePlannedBusyId={cal.movePlannedBusyId}
                dayDeleteAllBusy={cal.dayDeleteAllBusy}
                dayDeleteAllConfirm={cal.dayDeleteAllConfirm}
                setDayDeleteAllConfirm={cal.setDayDeleteAllConfirm}
                onDeleteAllDay={cal.deleteAllPlannedOnSelectedDay}
                onPlannedDeleted={cal.handlePlannedDeleted}
                onCalendarMutated={cal.handleDayCalendarMutated}
              />
            ) : null}
            <div className="mb-8 w-full min-w-0">
              <CoachWorkoutLibraryPanel
                athleteId={cal.athleteId}
                targetDate={cal.selectedDate}
                contractToSave={cal.calendarLibraryContract}
                saveTitle={cal.calendarLibraryContract?.sessionName ?? undefined}
                sourcePlannedId={cal.dayPlanned[0]?.id ?? null}
                onApplied={() => void cal.loadMonth()}
              />
            </div>
          </>
        ) : null}
      </section>

      {/* 4 · ANALISI — sessione del giorno aperta se ci sono eseguiti; il resto collassato. */}
      <section id="analisi" className="scroll-mt-28">
        {dataReady && cal.belowFoldReady ? (
          <div className="mb-8 space-y-4">
            <Pro2Accordion
              title="Sessione del giorno"
              subtitle={`${cal.selectedDate} · tracce, mappa e telemetria degli eseguiti`}
              accent="orange"
              defaultOpen={cal.dayExecuted.length > 0}
            >
              <CalendarDaySessionDetail
                selectedDate={cal.selectedDate}
                dayExecuted={cal.dayExecuted}
                athleteId={cal.athleteId}
              />
            </Pro2Accordion>
            <Pro2Accordion
              title="Analisi del giorno"
              subtitle={`${cal.selectedDate} · pianificato vs eseguito, serie e carico`}
              accent="orange"
            >
              <TrainingCalendarAnalyzer
                selectedDate={cal.selectedDate}
                dayPlanned={cal.dayPlanned}
                dayExecuted={cal.dayExecuted}
                monthExecuted={cal.executed}
                athleteId={cal.athleteId}
                onExecutedChanged={() => void cal.loadMonth()}
                onPlannedChanged={cal.handleAnalyzerPlannedChanged}
              />
            </Pro2Accordion>
            <Pro2Accordion
              title="Benessere del giorno"
              subtitle={`${cal.selectedDate} · sonno, HRV e recupero`}
              accent="orange"
            >
              <CalendarDayWellnessDetail athleteId={cal.athleteId} selectedDate={cal.selectedDate} />
            </Pro2Accordion>
          </div>
        ) : null}
      </section>

      {/* 5 · Avanzate — import da file (dietro toggle) e volume aggregato (collassato). */}
      {dataReady ? (
        <div className="mb-8 space-y-4">
          {cal.showFileImport ? (
            <CalendarFileImportSection
              athleteId={cal.athleteId}
              selectedDate={cal.selectedDate}
              saving={cal.saving}
              fileImportForm={cal.fileImportForm}
              setFileImportForm={cal.setFileImportForm}
              onSubmit={cal.handleFileImportSubmit}
            />
          ) : null}
          <Pro2Accordion
            title="Volume aggregato"
            subtitle="Totali degli eseguiti nella finestra del calendario"
            accent="orange"
          >
            <TrainingPeriodVolumeSummary athleteId={cal.athleteId} deferUntilVisible />
          </Pro2Accordion>
        </div>
      ) : null}

      {/* 6 · Dettagli e motore — metodologia, formati e diagnostica coach/admin. */}
      <CalendarEngineDetailsAccordion
        showTech={cal.showTech}
        athleteId={cal.athleteId}
        fetchFrom={cal.fetchFrom}
        fetchTo={cal.fetchTo}
        fetchDiag={cal.fetchDiag}
        executedCalendarGap={cal.executedCalendarGap}
        monthExecutedRenderedCount={cal.monthExecutedRenderedCount}
      />
    </Pro2ModulePageShell>
  );
}
