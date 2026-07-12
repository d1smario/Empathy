"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useLiveMetrics } from "./useLiveMetrics";
import type { LiveMetrics } from "@/components/marketing/WatchLabSection";

type Sig = { key: string; color: string; unit: string; get: (m: LiveMetrics) => string };

const SIGNALS: Sig[] = [
  { key: "sHr", color: "#f472b6", unit: "bpm", get: (m) => `${Math.round(m.hr)}` },
  { key: "sPwr", color: "#a78bfa", unit: "W", get: (m) => `${Math.round(m.pwr)}` },
  { key: "sSpd", color: "#22d3ee", unit: "km/h", get: (m) => m.spd.toFixed(1) },
  { key: "sCad", color: "#34d399", unit: "rpm", get: (m) => `${Math.round(m.cad)}` },
  { key: "sHrv", color: "#f472b6", unit: "ms", get: () => "68" },
  { key: "sSleep", color: "#a78bfa", unit: "h", get: () => "7:20" },
  { key: "sSpo2", color: "#22d3ee", unit: "%", get: () => "97" },
  { key: "sTemp", color: "#fbbf24", unit: "°C", get: () => "36.8" },
];

const INSIGHTS = [
  { key: "tlThreshold", value: "292 W", color: "#a78bfa" },
  { key: "tlReadiness", value: "82", color: "#34d399" },
  { key: "tlLoad", value: "+12%", color: "#22d3ee" },
];

/**
 * Hero "telemetria" di Come funziona: mostra il flusso DATO GREZZO → ANALISI → DECISIONE.
 * Nativo (SVG/CSS + useLiveMetrics), on-brand, leggero, reduced-motion safe.
 */
export function TelemetryHero() {
  const t = useTranslations("Vetrina.how");
  const m = useLiveMetrics(900);
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % 2);
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const msgs = [t("tlMsg1"), t("tlMsg2")];

  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40 p-4 text-left shadow-2xl backdrop-blur-xl sm:p-6">
      <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_0.9fr_auto_1fr]">
        {/* INGRESSO — dati grezzi */}
        <Zone label={t("tlIn")} dot="#22d3ee">
          <Waveform />
          <div className="tl-feed-mask mt-2 h-36 overflow-hidden">
            <div className="tl-feed space-y-1.5">
              {[...SIGNALS, ...SIGNALS].map((s, i) => (
                <SignalRow key={i} label={t(s.key)} value={s.get(m)} unit={s.unit} color={s.color} />
              ))}
            </div>
          </div>
        </Zone>

        <Flow />

        {/* ANALISI — nucleo che elabora */}
        <Zone label={t("tlCore")} dot="#a78bfa" center>
          <Core />
        </Zone>

        <Flow />

        {/* DECISIONE — intuizioni + piano */}
        <Zone label={t("tlOut")} dot="#f472b6">
          <div className="space-y-1.5">
            {INSIGHTS.map((it) => (
              <div
                key={it.key}
                className="tl-insight flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5"
              >
                <span className="text-[10px] uppercase tracking-wider text-gray-400">{t(it.key)}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: it.color }}>
                  {it.value}
                </span>
              </div>
            ))}
            <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-gray-400">{t("tlPlanLabel")}</span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase transition-colors duration-300 ${
                    flash ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-200" : "border-white/10 text-gray-600"
                  }`}
                >
                  ● {t("tlUpdated")}
                </span>
              </div>
              <p key={idx} className="tl-msg mt-1 text-sm font-bold text-white">
                {msgs[idx] ?? ""}
              </p>
            </div>
          </div>
        </Zone>
      </div>

      <p className="mt-4 text-center text-xs text-gray-500">{t("tlCaption")}</p>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .tl-run { animation: tlRun 2.6s linear infinite; }
          .tl-feed { animation: tlFeed 15s linear infinite; }
          .tl-flow-dash { animation: tlFlow 0.9s linear infinite; }
          .tl-scan { animation: tlSpin 3s linear infinite; }
          .tl-ring { animation: tlPulse 2.4s ease-in-out infinite; }
          .tl-ring2 { animation: tlPulse 2.4s ease-in-out infinite 0.5s; }
          .tl-core-dot { animation: tlDot 2s ease-in-out infinite; }
          .tl-insight:nth-child(1) { animation: tlGlow 3s ease-in-out infinite; }
          .tl-insight:nth-child(2) { animation: tlGlow 3s ease-in-out infinite 0.6s; }
          .tl-insight:nth-child(3) { animation: tlGlow 3s ease-in-out infinite 1.2s; }
          .tl-msg { animation: tlMsg 0.5s ease-out; }
        }
        .tl-run { stroke-dashoffset: 1030; }
        .tl-scan, .tl-ring, .tl-ring2 { transform-box: fill-box; transform-origin: center; }
        .tl-feed-mask { -webkit-mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent); mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent); }
        @keyframes tlRun { from { stroke-dashoffset: 1030; } to { stroke-dashoffset: 0; } }
        @keyframes tlFeed { from { transform: translateY(0); } to { transform: translateY(-50%); } }
        @keyframes tlFlow { from { stroke-dashoffset: 12; } to { stroke-dashoffset: 0; } }
        @keyframes tlSpin { to { transform: rotate(360deg); } }
        @keyframes tlPulse { 0%,100% { opacity: 0.2; transform: scale(0.97); } 50% { opacity: 0.55; transform: scale(1.03); } }
        @keyframes tlDot { 0%,100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes tlGlow { 0%,100% { border-color: rgba(255,255,255,0.06); } 50% { border-color: rgba(167,139,250,0.45); } }
        @keyframes tlMsg { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

function Zone({ label, dot, center, children }: { label: string; dot: string; center?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className={center ? "flex h-[calc(100%-1.75rem)] items-center justify-center" : ""}>{children}</div>
    </div>
  );
}

function SignalRow({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.02] px-2 py-1">
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        <span className="h-1 w-1 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="flex items-baseline gap-0.5">
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-[8px] text-gray-500">{unit}</span>
      </span>
    </div>
  );
}

function Waveform() {
  return (
    <svg viewBox="0 0 200 32" className="w-full" role="img" aria-hidden>
      <polyline
        points="0,16 20,16 26,6 32,26 38,11 44,16 70,16 76,7 82,25 88,16 120,16 126,5 132,27 138,16 170,16 176,8 182,24 188,16 200,16"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1000}
        className="tl-run"
        style={{ strokeDasharray: "30 1000" }}
      />
    </svg>
  );
}

function Flow() {
  return (
    <div className="hidden items-center justify-center lg:flex">
      <svg viewBox="0 0 26 12" className="w-6" aria-hidden>
        <path className="tl-flow-dash" d="M2 6 h17" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 4" />
        <path d="M17 2 l5 4 l-5 4" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Core() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#a78bfa" strokeWidth="1" opacity="0.15" />
        <circle className="tl-ring" cx="50" cy="50" r="34" fill="none" stroke="#a78bfa" strokeWidth="1" />
        <circle className="tl-ring2" cx="50" cy="50" r="22" fill="none" stroke="#22d3ee" strokeWidth="1.2" />
        <circle
          className="tl-scan"
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="#f472b6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="22 270"
        />
      </svg>
      <span className="tl-core-dot absolute h-3 w-3 rounded-full bg-gradient-to-br from-pink-400 to-violet-400 shadow-[0_0_14px_rgba(244,114,182,0.7)]" />
    </div>
  );
}
