"use client";

import { Droplets } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActiveAthlete } from "@/lib/use-active-athlete";

function liters(ml: number): string {
  return (ml / 1000).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function TodayHydrationTracker({
  targetMl,
  currentMl,
  onAddIntake,
  busy,
}: {
  targetMl: number;
  currentMl: number;
  onAddIntake?: (deltaMl: number) => void;
  busy?: boolean;
}) {
  const t = useTranslations("TodayPage");
  // Vista coach/admin = sola lettura: niente pulsanti di interazione idratazione.
  const { adminScoped } = useActiveAthlete();
  const pct = targetMl > 0 ? Math.min(100, Math.round((currentMl / targetMl) * 100)) : 0;
  const done = targetMl > 0 && currentMl >= targetMl;

  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-cyan-300" aria-hidden />
          <h2 className="text-base font-bold text-white">{t("hydration")}</h2>
        </div>
        <p className="text-2xl font-black tabular-nums text-cyan-100">
          {liters(currentMl)} <span className="text-base font-semibold text-cyan-300/70">/ {liters(targetMl)} L</span>
          {done ? <span className="ml-1 text-emerald-300">✓</span> : null}
        </p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, backgroundColor: done ? "rgba(52, 211, 153, 0.85)" : "rgba(34, 211, 238, 0.8)" }}
        />
      </div>
      {onAddIntake && !adminScoped ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || currentMl <= 0}
            onClick={() => onAddIntake(-250)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
          >
            −250 ml
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAddIntake(250)}
            className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40"
          >
            +250 ml
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAddIntake(500)}
            className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40"
          >
            +500 ml
          </button>
        </div>
      ) : null}
    </section>
  );
}
