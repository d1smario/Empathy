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

/** Finestra legata alla seduta (pre/intra/post/durante) → tono ambra, il resto acqua/cyan. */
function isTrainingWindow(labelIt: string): boolean {
  return /pre|intra|post|durante|allenament|seduta|workout/i.test(labelIt);
}

export function HydrationDayCard({ routine }: { routine: HydrationRoutineVm }) {
  const t = useTranslations("HydrationDayCard");
  const windows = routine.windows ?? [];
  const maxVolume = Math.max(1, ...windows.map((w) => w.volumeMl));
  const basePct = routine.totalTargetMl > 0
    ? Math.round((routine.baselineDailyMl / routine.totalTargetMl) * 100)
    : 100;

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
        <div className="text-right">
          <p className="text-3xl font-black tabular-nums text-cyan-200">
            {liters(routine.totalTargetMl)} <span className="text-base font-bold text-cyan-300/70">L</span>
          </p>
          <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">{t("dailyTotal")}</p>
        </div>
      </div>

      {/* Base vs extra allenamento: una barra, due nature. */}
      <div className="mt-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
          <div
            className="h-full bg-cyan-500/70"
            style={{ width: `${Math.min(100, Math.max(0, basePct))}%` }}
            aria-hidden
          />
          {routine.trainingExtraMl > 0 ? (
            <div className="h-full flex-1 bg-amber-500/70" aria-hidden />
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-500/70" aria-hidden />
            {t("baseLabel", { liters: liters(routine.baselineDailyMl) })}
          </span>
          {routine.trainingExtraMl > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500/70" aria-hidden />
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
              const hPct = Math.max(14, Math.round((w.volumeMl / maxVolume) * 100));
              return (
                <div key={`hyd-col-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={w.notesIt}>
                  <span className="text-[0.65rem] font-bold tabular-nums text-white">{w.volumeMl}</span>
                  <div className="flex h-24 w-full max-w-[52px] items-end overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    <div
                      className={`w-full rounded-t-sm ${training ? "bg-amber-400/80" : "bg-cyan-400/80"}`}
                      style={{ height: `${hPct}%` }}
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
