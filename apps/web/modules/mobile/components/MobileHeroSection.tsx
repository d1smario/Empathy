"use client";

import { DashboardReadinessRing } from "@/components/dashboard/DashboardReadinessRing";

type MobileHeroSectionProps = {
  score: number | null;
  label: string | null;
};

export function MobileHeroSection({ score, label }: MobileHeroSectionProps) {
  return (
    <section className="relative flex items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-white">
          Understand Today.
          <br />
          <span className="bg-gradient-to-r from-pink-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
            Predict Tomorrow.
          </span>
        </h1>
        <p className="mt-2 text-xs text-gray-400">Human Performance Operating System</p>
      </div>
      <div className="shrink-0 rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
        <div className="text-[0.55rem] uppercase tracking-wider text-gray-500">Readiness Score</div>
        <div className="mt-1 flex items-center gap-2">
          <DashboardReadinessRing score={score} size="sm" />
          <div>
            <div className="text-sm font-semibold capitalize text-white">{label ?? "In attesa"}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
