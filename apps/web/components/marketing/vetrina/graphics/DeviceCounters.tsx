"use client";

import { useEffect, useState } from "react";
import { AnimatedCounter } from "./AnimatedCounter";

type Labels = { live: string; heart: string; speed: string; power: string; cadence: string };

/** Contatori "live" dal dispositivo: battito, velocità, potenza, cadenza. */
export function DeviceCounters({ labels }: { labels: Labels }) {
  const [hr, setHr] = useState(148);
  const [seen, setSeen] = useState(false);

  // Micro-fluttuazione del battito per dare la sensazione "in tempo reale".
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setSeen(true);
      setHr((v) => Math.max(139, Math.min(157, v + (Math.round(Math.sin(Date.now() / 900) * 2)))));
    }, 1400);
    return () => clearInterval(t);
  }, []);

  const tiles = [
    { label: labels.heart, value: hr, unit: "bpm", accent: "#f472b6", live: true, decimals: 0 },
    { label: labels.speed, value: 34.6, unit: "km/h", accent: "#67e8f9", live: false, decimals: 1 },
    { label: labels.power, value: 286, unit: "W", accent: "#c4b5fd", live: false, decimals: 0 },
    { label: labels.cadence, value: 92, unit: "rpm", accent: "#fbbf24", live: false, decimals: 0 },
  ];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-purple-600/15 to-pink-600/15 blur-2xl" aria-hidden />
      <div className="grid grid-cols-2 gap-3 rounded-[1.6rem] border border-white/10 bg-[#0b0b0f] p-4 shadow-2xl">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-gray-500">{t.label}</span>
              {t.live ? (
                <span className="flex items-center gap-1 text-[9px] font-semibold uppercase text-emerald-400">
                  <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${seen ? "animate-pulse" : ""}`} />
                  {labels.live}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black tabular-nums" style={{ color: t.accent }}>
                <AnimatedCounter value={t.value} decimals={t.decimals} />
              </span>
              <span className="text-xs font-medium text-gray-500">{t.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
