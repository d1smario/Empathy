"use client";

import { Droplets, Minus, Pill, Plus, Wheat } from "lucide-react";
import type { TodayAdjustment } from "@/app/api/today/contracts";

/**
 * «Compensazione di oggi» — extra additivi del loop adattivo (reintegro/riduzione) sopra il
 * piano base. Reintegro (verde): hai speso di più → aggiungi cibo/acqua/integratori. Riduzione
 * (ambra): allenamento non fatto → alleggerisci i pasti rimanenti. Sempre col motivo.
 */
export function TodayAdjustmentCard({ adjustments }: { adjustments: TodayAdjustment[] }) {
  const active = adjustments.filter((a) => a.extraKcal !== 0 || a.extraWaterMl !== 0 || a.supplements.length > 0);
  if (active.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Compensazione di oggi</h2>
      {active.map((a) => {
        const isAdd = a.kind === "reintegration";
        const tone = isAdd
          ? "border-emerald-500/30 bg-emerald-500/[0.07]"
          : "border-amber-500/30 bg-amber-500/[0.07]";
        return (
          <div key={a.kind} className={`rounded-2xl border ${tone} p-4`}>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                  isAdd ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {isAdd ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </span>
              <p className={`text-sm font-bold ${isAdd ? "text-emerald-100" : "text-amber-100"}`}>
                {isAdd ? "Piano + reintegro" : "Piano alleggerito"}
              </p>
            </div>

            {a.reason ? <p className="mt-2 text-sm text-gray-300">{a.reason}</p> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {a.extraKcal !== 0 ? (
                <Chip label={`${a.extraKcal > 0 ? "+" : ""}${a.extraKcal} kcal`} add={isAdd} />
              ) : null}
              {a.extraCarbsG > 0 ? (
                <Chip icon={<Wheat className="h-3.5 w-3.5" />} label={`+${a.extraCarbsG} g carbo`} add />
              ) : null}
              {a.extraWaterMl > 0 ? (
                <Chip icon={<Droplets className="h-3.5 w-3.5" />} label={`+${a.extraWaterMl} ml acqua`} add water />
              ) : null}
              {a.supplements.map((s) => (
                <Chip key={s} icon={<Pill className="h-3.5 w-3.5" />} label={s} add supp />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Chip({
  label,
  icon,
  add,
  water,
  supp,
}: {
  label: string;
  icon?: React.ReactNode;
  add: boolean;
  water?: boolean;
  supp?: boolean;
}) {
  const cls = water
    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
    : supp
      ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
      : add
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
        : "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${cls}`}>
      {icon} {label}
    </span>
  );
}
