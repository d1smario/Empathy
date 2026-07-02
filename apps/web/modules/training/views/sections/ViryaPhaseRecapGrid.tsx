"use client";

import { useTranslations } from "next-intl";

import {
  phaseColor,
  phaseLabels,
  VIRYA_LOAD_SHORT,
  type PhasePlan,
} from "@/lib/training/virya/virya-annual-plan-kit";

export type ViryaPhaseRecapGridProps = {
  phases: PhasePlan[];
  strengthPhaseLoadHints: Map<string, { avgLoad: number; avgSessions: number }>;
};

export function ViryaPhaseRecapGrid({
  phases,
  strengthPhaseLoadHints,
}: ViryaPhaseRecapGridProps) {
  const t = useTranslations("ViryaPhaseRecapGrid");
  return (
          <div className="mt-5">
            <div className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-pink-300">{t("phaseRecapTitle")}</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {phases.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-[0_0_0_1px_rgba(251,113,133,0.08)]"
                >
                  <div className="h-1.5 w-full" style={{ background: phaseColor(p.phase) }} />
                  <div className="p-3">
                    <div className="text-sm font-bold text-white">{phaseLabels[p.phase]}</div>
                    <div className="mt-1 font-mono text-[0.7rem] text-slate-400">
                      {p.start} → {p.end}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-md border border-orange-400/40 bg-orange-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-orange-100">
                        {VIRYA_LOAD_SHORT} {t("weeklyLoad", { weeklyTss: p.weeklyTss })}
                        {strengthPhaseLoadHints.get(p.id) ? (
                          <span className="ml-1 text-[0.6rem] font-normal text-slate-500">
                            {t("progressionHint", { avgLoad: strengthPhaseLoadHints.get(p.id)!.avgLoad })}
                          </span>
                        ) : null}
                      </span>
                      <span className="rounded-md border border-pink-400/40 bg-pink-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-pink-100">
                        {t("sessionsPerWeek", { sessions: p.sessionsPerWeek })}
                      </span>
                    </div>
                    {p.mesocycle ? <div className="mt-2 text-[0.65rem] text-slate-500">{p.mesocycle}</div> : null}
                    {p.notes ? <div className="mt-1 text-[0.62rem] leading-snug text-slate-600">{p.notes}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
  );
}
