"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Reveal } from "./Reveal";

/**
 * "Provalo": slider interattivo — l'utente sceglie come sta oggi e vede il piano di
 * domani ricalcolarsi in diretta (allenamento, nutrizione, recupero + readiness).
 * Rende TANGIBILE il cuore adattivo di Empathy. Nativo, nessun costo esterno.
 */
export function VetrinaTryIt() {
  const t = useTranslations("Vetrina.tryit");
  const [v, setV] = useState(35);

  const readiness = Math.round(92 - v * 0.5); // 92 → 42
  const volume = Math.round(((50 - v) / 50) * 20); // +20% → −20%
  const carbs = Math.round((v / 100) * 60); // 0 → 60 g
  const sleep = Math.round((v / 100) * 45); // 0 → 45 min
  const zone = v < 33 ? "verdictFresh" : v < 66 ? "verdictMid" : "verdictTired";
  const color = readiness > 72 ? "#34d399" : readiness > 55 ? "#fbbf24" : "#f472b6";

  const cards = [
    { label: t("cardTraining"), sub: t("cardTrainingSub"), value: `${volume >= 0 ? "+" : ""}${volume}%`, color: "#f472b6" },
    { label: t("cardNutrition"), sub: t("cardNutritionSub"), value: `+${carbs} g`, color: "#a78bfa" },
    { label: t("cardRecovery"), sub: t("cardRecoverySub"), value: `+${sleep} min`, color: "#22d3ee" },
  ];

  const circ = 2 * Math.PI * 26;

  return (
    <section className="mx-auto mt-28 max-w-4xl px-1">
      <Reveal className="text-center">
        <span className="inline-flex rounded-full border border-pink-400/30 bg-pink-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-pink-200">
          {t("eyebrow")}
        </span>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">{t("title")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("sub")}</p>
      </Reveal>

      <Reveal delay={100}>
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          {/* slider */}
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-gray-400">
            <span>{t("freshLabel")}</span>
            <span>{t("tiredLabel")}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={v}
            onChange={(e) => setV(Number(e.target.value))}
            aria-label={t("sliderLabel")}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-emerald-400/60 via-amber-400/60 to-pink-500/60"
            style={{ accentColor: color }}
          />

          {/* readiness + verdetto */}
          <div className="mt-8 flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke={color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(circ * readiness) / 100} ${circ}`}
                  style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.3s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black tabular-nums" style={{ color }}>
                  {readiness}
                </span>
                <span className="text-[8px] uppercase tracking-wider text-gray-500">{t("readinessLabel")}</span>
              </div>
            </div>
            <p className="text-base font-bold text-white sm:text-lg">{t(zone)}</p>
          </div>

          {/* piano ricalcolato */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{c.label}</span>
                <div className="mt-1 text-2xl font-black tabular-nums" style={{ color: c.color }}>
                  {c.value}
                </div>
                <span className="text-xs text-gray-400">{c.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
