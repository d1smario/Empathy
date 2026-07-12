"use client";

import { Activity, Droplets, Info, Pill, Plus, Utensils } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Anteprima CAMPIONE del piano nel paywall (pre-acquisto). Contenuto GENERICO e fisso — NON i
 * dati dell'atleta: mostra il valore del prodotto (macro periodizzato + giornata con allenamento
 * e pasti + compensazione adattiva) senza regalare il piano personalizzato (anti-abuso della prova).
 * Il piano reale, sui dati della persona, si sblocca solo quando inizia.
 */
export function SamplePlanPreview() {
  const t = useTranslations("AccessPlanSample");

  const phases: Array<{ key: string; tone: string }> = [
    { key: "base", tone: "border-cyan-500/40 bg-cyan-500/10 text-cyan-100" },
    { key: "base", tone: "border-cyan-500/40 bg-cyan-500/10 text-cyan-100" },
    { key: "build", tone: "border-orange-500/40 bg-orange-500/10 text-orange-100" },
    { key: "deload", tone: "border-white/15 bg-white/5 text-gray-300" },
  ];
  const meals: Array<{ slot: string; foods: string; kcal: number }> = [
    { slot: "breakfast", foods: t("meals.breakfast"), kcal: 520 },
    { slot: "lunch", foods: t("meals.lunch"), kcal: 680 },
    { slot: "dinner", foods: t("meals.dinner"), kcal: 640 },
  ];

  return (
    <section className="mt-4" aria-label={t("title")}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-cyan-300">{t("eyebrow")}</p>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-gray-400">
            {t("badge")}
          </span>
        </div>
        <h3 className="mt-2 text-lg font-bold text-white">{t("title")}</h3>

        {/* Striscia periodizzazione (la vision d'insieme) */}
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">{t("periodizationLabel")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {phases.map((p, i) => (
              <span key={i} className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.tone}`}>
                {t(`phases.${p.key}`)}
              </span>
            ))}
            <span className="self-center text-xs text-gray-600">→ …</span>
          </div>
        </div>

        {/* Giornata campione */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-4">
            <div className="flex items-center gap-2 text-orange-200">
              <Activity className="h-4 w-4" />
              <p className="text-sm font-bold">{t("workout.title")}</p>
            </div>
            <p className="mt-1 text-sm text-gray-300">{t("workout.detail")}</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-100">
              <Plus className="h-3.5 w-3.5" />
              <span>{t("compensation")}</span>
              <Droplets className="ml-auto h-3.5 w-3.5 text-cyan-300" />
              <Pill className="h-3.5 w-3.5 text-violet-300" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 text-white">
              <Utensils className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-bold">{t("mealsTitle")}</p>
            </div>
            <ul className="mt-2 space-y-1.5">
              {meals.map((m) => (
                <li key={m.slot} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-gray-300">
                    <span className="font-semibold text-gray-200">{t(`slots.${m.slot}`)}:</span> {m.foods}
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-500">{m.kcal} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer anti-abuso */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] px-3.5 py-3 text-xs text-cyan-100/90">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <p>{t("disclaimer")}</p>
        </div>
      </div>
    </section>
  );
}
