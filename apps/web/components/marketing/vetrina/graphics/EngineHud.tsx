"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLiveMetrics } from "./useLiveMetrics";
import { useHeroSport } from "./HeroSportContext";

type Tile = { label: string; value: string; unit: string; color: string };

/**
 * "Vista del motore" Empathy SINCRONIZZATA con la clip attiva dell'hero:
 * le metriche cambiano in base allo sport (ciclismo → PWR/SPD, palestra → carico/serie,
 * corsa → passo/cadenza) e il piano si aggiorna coerente. reduced-motion safe.
 */
export function EngineHud() {
  const t = useTranslations("Vetrina.hud");
  const m = useLiveMetrics(900);
  const { sport } = useHeroSport();
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState(false);

  // rotazione dei messaggi del piano
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setIdx((i) => i + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  // cambio sport → il piano "si aggiorna" con un flash
  useEffect(() => {
    setIdx(0);
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(id);
  }, [sport]);

  const pace = (kmh: number) => {
    const p = 60 / kmh;
    const mm = Math.floor(p);
    const ss = Math.round((p - mm) * 60);
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  };

  const PINK = "#f472b6";
  const VIOLET = "#a78bfa";
  const CYAN = "#22d3ee";
  const load = 120 + Math.round(((m.pwr - 230) / 115) * 60); // 120–180 kg
  const runSpd = 15 + ((m.spd - 29) / 12) * 3; // 15–18 km/h

  const TILES: Record<number, Tile[]> = {
    0: [
      { label: "HR", value: `${Math.round(m.hr)}`, unit: "bpm", color: PINK },
      { label: "PWR", value: `${Math.round(m.pwr)}`, unit: "W", color: VIOLET },
      { label: "SPD", value: m.spd.toFixed(1), unit: "km/h", color: CYAN },
    ],
    1: [
      { label: "HR", value: `${Math.round(m.hr - 22)}`, unit: "bpm", color: PINK },
      { label: t("tileLoad"), value: `${load}`, unit: "kg", color: VIOLET },
      { label: t("tileSets"), value: "4", unit: "/ 5", color: CYAN },
    ],
    2: [
      { label: "HR", value: `${Math.round(m.hr + 9)}`, unit: "bpm", color: PINK },
      { label: t("tilePace"), value: pace(runSpd), unit: "/km", color: VIOLET },
      { label: t("tileCad"), value: `${Math.round(m.cad + 88)}`, unit: "spm", color: CYAN },
    ],
  };
  const MSGS: Record<number, string[]> = {
    0: [t("cyc1"), t("cyc2")],
    1: [t("gym1"), t("gym2")],
    2: [t("run1"), t("run2")],
  };
  const tiles = TILES[sport] ?? TILES[0]!;
  const msgs = MSGS[sport] ?? MSGS[0]!;
  const msg = msgs[idx % msgs.length] ?? "";

  return (
    <div className="w-full max-w-sm rounded-[1.5rem] border border-white/10 bg-black/50 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <span className="hud-live h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {t("engineLabel")}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">{t("live")}</span>
      </div>

      {/* metriche live, coerenti con lo sport della clip */}
      <div key={sport} className="hud-msg mt-4 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
            <span className="text-[9px] uppercase tracking-wider text-gray-500">{tile.label}</span>
            <div className="mt-0.5 flex items-baseline gap-0.5">
              <span className="text-xl font-black tabular-nums" style={{ color: tile.color }}>{tile.value}</span>
              <span className="text-[9px] text-gray-500">{tile.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* segnale che scorre */}
      <svg viewBox="0 0 320 40" className="mt-3 w-full" role="img" aria-hidden>
        <polyline
          points="0,20 24,20 32,8 40,32 48,14 56,20 88,20 96,10 104,30 112,20 150,20 158,6 166,34 174,20 210,20 218,12 226,28 234,20 280,20 288,9 296,31 304,20 320,20"
          fill="none"
          stroke="#22d3ee"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1000}
          className="hud-run"
          style={{ strokeDasharray: "36 1000" }}
        />
      </svg>

      {/* il piano che si aggiorna, coerente con lo sport */}
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">{t("planLabel")}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase transition-colors duration-300 ${
              flash ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : "border-white/10 text-gray-600"
            }`}
          >
            ● {t("updated")}
          </span>
        </div>
        <p key={`${sport}-${idx}`} className="hud-msg mt-1.5 text-sm font-semibold text-white">
          {msg}
        </p>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .hud-live { animation: hudLive 1.4s ease-in-out infinite; }
          .hud-run { animation: hudRun 3s linear infinite; }
          .hud-msg { animation: hudMsg 0.5s ease-out; }
        }
        .hud-run { stroke-dashoffset: 1036; }
        @keyframes hudLive { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes hudRun { from { stroke-dashoffset: 1036; } to { stroke-dashoffset: 0; } }
        @keyframes hudMsg { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
