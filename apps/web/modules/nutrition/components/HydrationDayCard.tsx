"use client";

import { useTranslations } from "next-intl";
import { Droplets } from "lucide-react";

/**
 * «Quanto bere oggi» — sezione visiva dell'idratazione nel Piano (2026-07,
 * feedback utente: prima era una tabella nascosta in un <details>).
 * Tutto deterministico dalla hydrationRoutine del piano: totale, base vs extra
 * allenamento, timeline oraria a colonne e finestre con elettroliti.
 */

export type HydrationRoutineVm = {
  totalTargetMl: number;
  baselineDailyMl: number;
  trainingExtraMl: number;
  windows: {
    labelIt: string;
    scheduledTimeLocal: string;
    volumeMl: number;
    sodiumMg: number;
    potassiumMg: number;
    magnesiumMg: number;
    notesIt: string;
  }[];
};

function liters(ml: number): string {
  return (ml / 1000).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Colori dei riempimenti INLINE (non classi Tailwind): le utility nuove in un
 * file nuovo possono mancare dal CSS compilato finché il watcher non riparte —
 * successo in dev: colonne e barra trasparenti (bug segnalato). Inline = sempre.
 */
const WATER_FILL = "rgba(34, 211, 238, 0.8)"; // cyan-400/80
const TRAINING_FILL = "rgba(251, 191, 36, 0.8)"; // amber-400/80
const WATER_BAR = "rgba(6, 182, 212, 0.7)"; // cyan-500/70
const TRAINING_BAR = "rgba(245, 158, 11, 0.7)"; // amber-500/70

/**
 * Finestra legata alla SEDUTA → tono ambra, il resto acqua/cyan. Niente
 * pre/post generici: «pre-primo pasto» è colazione, non allenamento
 * (falso positivo visto in verifica live).
 */
function isTrainingWindow(labelIt: string): boolean {
  return /allenament|seduta|workout|gara|\bintra\b/i.test(labelIt);
}

export function HydrationDayCard({
  routine,
  minDailyMl,
  intakeMl = 0,
  onAddIntake,
  intakeBusy = false,
}: {
  routine: HydrationRoutineVm;
  /** Idratazione minima del giorno (dal target giornaliero — vive qui, non più sotto i KPI). */
  minDailyMl?: number | null;
  /** Ml bevuti registrati dall'utente per la data selezionata. */
  intakeMl?: number;
  /** Registra bevuta (+/- ml). Assente = card in sola consultazione (es. schede admin). */
  onAddIntake?: (deltaMl: number) => void;
  intakeBusy?: boolean;
}) {
  const t = useTranslations("HydrationDayCard");
  const windows = routine.windows ?? [];
  const maxVolume = Math.max(1, ...windows.map((w) => w.volumeMl));
  const basePct = routine.totalTargetMl > 0
    ? Math.round((routine.baselineDailyMl / routine.totalTargetMl) * 100)
    : 100;
  const intakePct = routine.totalTargetMl > 0
    ? Math.min(100, Math.round((intakeMl / routine.totalTargetMl) * 100))
    : 0;
  const intakeDone = routine.totalTargetMl > 0 && intakeMl >= routine.totalTargetMl;

  return (
    <section className="viz-card builder-panel" style={{ marginBottom: 12 }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-cyan-300" aria-hidden />
            <h3 className="viz-title text-base">{t("title")}</h3>
          </div>
          <p className="mt-1 text-xs text-gray-400">{t("subtitle")}</p>
        </div>
        {/* Etichetta e minimo AFFIANCO al numero, non sotto (feedback utente 2026-07). */}
        <div className="flex items-center gap-2.5">
          <p className="text-3xl font-black tabular-nums text-cyan-200">
            {liters(routine.totalTargetMl)} <span className="text-base font-bold text-cyan-300/70">L</span>
          </p>
          <div className="text-left leading-tight">
            <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">{t("dailyTotal")}</p>
            {minDailyMl != null && minDailyMl > 0 ? (
              <p className="text-[0.65rem] text-gray-500">{t("minDaily", { liters: liters(minDailyMl) })}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Conferma di aver bevuto e quanto: contatore della giornata (2026-07,
          gemello delle conferme pasto — il Piano è l'unica pagina del giorno). */}
      {onAddIntake ? (
        <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-cyan-200/90">{t("drunkToday")}</p>
            <p className="text-sm font-black tabular-nums text-white">
              {liters(intakeMl)} L
              <span className="font-semibold text-gray-500"> / {liters(routine.totalTargetMl)} L</span>
              {intakeDone ? <span className="ml-1 text-emerald-300">✓</span> : null}
            </p>
          </div>
          <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${intakePct}%`, backgroundColor: intakeDone ? "rgba(52, 211, 153, 0.85)" : WATER_FILL }}
              aria-hidden
            />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={intakeBusy || intakeMl <= 0}
              onClick={() => onAddIntake(-250)}
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              −250 ml
            </button>
            <button
              type="button"
              disabled={intakeBusy}
              onClick={() => onAddIntake(250)}
              className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:opacity-40"
            >
              +250 ml
            </button>
            <button
              type="button"
              disabled={intakeBusy}
              onClick={() => onAddIntake(500)}
              className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:opacity-40"
            >
              +500 ml
            </button>
            {intakeBusy ? <span className="self-center text-[0.7rem] text-gray-500">{t("savingIntake")}</span> : null}
          </div>
        </div>
      ) : null}

      {/* Base vs extra allenamento: una barra, due nature. */}
      <div className="mt-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
          <div
            className="h-full"
            style={{ width: `${Math.min(100, Math.max(0, basePct))}%`, backgroundColor: WATER_BAR }}
            aria-hidden
          />
          {routine.trainingExtraMl > 0 ? (
            <div className="h-full flex-1" style={{ backgroundColor: TRAINING_BAR }} aria-hidden />
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: WATER_BAR }} aria-hidden />
            {t("baseLabel", { liters: liters(routine.baselineDailyMl) })}
          </span>
          {routine.trainingExtraMl > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TRAINING_BAR }} aria-hidden />
              {t("trainingLabel", { liters: liters(routine.trainingExtraMl) })}
            </span>
          ) : null}
        </div>
      </div>

      {/* Timeline della giornata: una colonna d'acqua per finestra, alta quanto il volume. */}
      {windows.length ? (
        <div className="mt-5">
          <div className="flex items-end gap-2 sm:gap-3" style={{ minHeight: 120 }}>
            {windows.map((w, i) => {
              const training = isTrainingWindow(w.labelIt);
              // Altezza in PIXEL (contenitore h-24 = 96px): la % dentro il flex
              // non risolveva e le colonne restavano vuote (bug segnalato).
              const fillPx = Math.max(14, Math.round((w.volumeMl / maxVolume) * 96));
              return (
                <div key={`hyd-col-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={w.notesIt}>
                  <span className="text-[0.65rem] font-bold tabular-nums text-white">{w.volumeMl}</span>
                  <div className="flex h-24 w-full max-w-[52px] items-end overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    <div
                      className="w-full rounded-t-sm"
                      style={{ height: `${fillPx}px`, backgroundColor: training ? TRAINING_FILL : WATER_FILL }}
                      aria-hidden
                    />
                  </div>
                  <span className="font-mono text-[0.6rem] tabular-nums text-gray-400">{w.scheduledTimeLocal}</span>
                  <span className="w-full truncate text-center text-[0.58rem] uppercase tracking-wide text-gray-500">
                    {w.labelIt}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-right text-[0.6rem] text-gray-600">{t("columnsUnit")}</p>
        </div>
      ) : null}

      {/* Elettroliti per finestra: chip compatte al posto della vecchia tabella. */}
      {windows.some((w) => w.sodiumMg > 0 || w.potassiumMg > 0 || w.magnesiumMg > 0) ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {windows
            .filter((w) => w.sodiumMg > 0 || w.potassiumMg > 0 || w.magnesiumMg > 0)
            .map((w, i) => (
              <div key={`hyd-ele-${i}`} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[0.65rem] font-semibold text-gray-300">
                  {w.labelIt} <span className="font-mono text-gray-500">· {w.scheduledTimeLocal}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[0.62rem] font-mono tabular-nums">
                  {w.sodiumMg > 0 ? (
                    <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">Na {w.sodiumMg}</span>
                  ) : null}
                  {w.potassiumMg > 0 ? (
                    <span className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-teal-200">K {w.potassiumMg}</span>
                  ) : null}
                  {w.magnesiumMg > 0 ? (
                    <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-violet-200">Mg {w.magnesiumMg}</span>
                  ) : null}
                  <span className="text-gray-600">mg</span>
                </div>
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}
