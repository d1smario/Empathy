"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";

export type ViryaHeroHeaderProps = {
  planName: string;
  setPlanName: Dispatch<SetStateAction<string>>;
  viryaHeroStats: Array<{ label: string; value: string }>;
};

export function ViryaHeroHeader({
  planName,
  setPlanName,
  viryaHeroStats,
}: ViryaHeroHeaderProps) {
  const t = useTranslations("ViryaHeroHeader");
  return (
      <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/25 via-black/50 to-black/80 p-5 shadow-inner">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-violet-300/90">Piano</p>
        <h2 className="text-xl font-semibold tracking-tight text-white">{t("annualPlanTitle")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          {t("intro")}
        </p>
        <div className="mt-4 max-w-xl">
          <label className="block text-xs font-semibold uppercase tracking-wider text-fuchsia-300/90">
            {t("annualPlanNameLabel")}
          </label>
          <input
            className="mt-1.5 w-full rounded-xl border border-fuchsia-500/35 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-fuchsia-500/20 focus:ring-2"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder={t("planNamePlaceholder")}
          />
          <p className="mt-1.5 text-[0.68rem] text-slate-500">
            {t("calendarTagPrefix")} <span className="text-cyan-300/90">{planName.trim() || "—"}</span> {t("calendarTagSuffix")}
          </p>
        </div>
        {viryaHeroStats.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {viryaHeroStats.map((s) => (
              <span
                key={s.label}
                className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-slate-300"
              >
                <span className="text-slate-500">{s.label}:</span> {s.value}
              </span>
            ))}
          </div>
        ) : null}
      </div>
  );
}
