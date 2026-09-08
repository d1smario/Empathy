"use client";

import type { LucideIcon } from "lucide-react";
import { Drumstick, Droplets, Flame, Wheat } from "lucide-react";

function KpiCard({
  label,
  value,
  unit,
  hint,
  secondary,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  hint?: string;
  /** Seconda riga sotto il numero: il servito accanto al target, col suo nome. */
  secondary?: { label: string; value: string; unit: string } | null;
  icon: LucideIcon;
}) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner">
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/45 bg-amber-500/35 text-amber-50"
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={2.35} />
          </div>
        </div>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-50">
          {value}
          <span className="ml-1 text-xs font-medium text-gray-500">{unit}</span>
        </p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
        {secondary ? (
          <p className="mt-1.5 border-t border-white/10 pt-1.5 text-xs text-gray-400">
            {secondary.label}{" "}
            <span className="font-mono font-semibold tabular-nums text-gray-200">
              {secondary.value}
              <span className="ml-0.5 font-medium text-gray-500">{secondary.unit}</span>
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type NutritionDayKpiTargets = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

/**
 * Etichette dal chiamante (che ha le traduzioni). Senza, restano le stringhe storiche IT:
 * questo componente è presentazione, non decide che cosa sono i numeri che riceve.
 */
export type NutritionDayKpiCopy = {
  energy?: string;
  carbs?: string;
  protein?: string;
  fat?: string;
  /** Sottotitolo della card energia: dice CHE COS'È il numero (target del piano, o stima). */
  energyHint?: string;
  carbsHint?: string;
  proteinHint?: string;
  fatHint?: string;
  /** Nome della seconda riga (il servito). */
  served?: string;
};

type NutritionDayKpiStripProps = {
  targets: NutritionDayKpiTargets;
  dateLabel?: string;
  /**
   * Il servito del piano, mostrato sotto il target su ciascuna card. Null quando non c'è un
   * piano: senza voci non esiste un «nel piatto» da stampare, e inventarne uno sarebbe il
   * quarto numero della giornata invece del secondo.
   */
  served?: NutritionDayKpiTargets | null;
  copy?: NutritionDayKpiCopy;
};

/**
 * KPI giornalieri principali (stesso linguaggio visivo dei KpiCard del Builder training).
 * Due righe per card e non una: il target e, sotto, quanto c'è nel piatto.
 */
export function NutritionDayKpiStrip({ targets, dateLabel, served, copy }: NutritionDayKpiStripProps) {
  const kcal = Math.round(targets.kcal);
  const c = Math.round(targets.carbsG);
  const p = Math.round(targets.proteinG);
  const f = Math.round(targets.fatG);
  const servedLabel = copy?.served ?? "Nel piatto";
  const servedRow = (value: number, unit: string) =>
    served ? { label: servedLabel, value: `${Math.round(value)}`, unit } : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label={copy?.energy ?? "Energia giorno"}
        value={`${kcal}`}
        unit="kcal"
        hint={copy?.energyHint ?? (dateLabel ? `Target · ${dateLabel}` : "Budget energetico giornaliero")}
        secondary={servedRow(served?.kcal ?? 0, "kcal")}
        icon={Flame}
      />
      <KpiCard
        label={copy?.carbs ?? "Carboidrati"}
        value={`${c}`}
        unit="g"
        hint={copy?.carbsHint ?? "CHO totale"}
        secondary={servedRow(served?.carbsG ?? 0, "g")}
        icon={Wheat}
      />
      <KpiCard
        label={copy?.protein ?? "Proteine"}
        value={`${p}`}
        unit="g"
        hint={copy?.proteinHint ?? "PRO totale"}
        secondary={servedRow(served?.proteinG ?? 0, "g")}
        icon={Drumstick}
      />
      <KpiCard
        label={copy?.fat ?? "Grassi"}
        value={`${f}`}
        unit="g"
        hint={copy?.fatHint ?? "Lipidi totali"}
        secondary={servedRow(served?.fatG ?? 0, "g")}
        icon={Droplets}
      />
    </div>
  );
}
