"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Activity, Gauge, Radio } from "lucide-react";

import { AthleteCanvas } from "./hero/AthleteCanvas";

/* =========================================================================
 * COPY — edit Italian text here
 * ========================================================================= */
const COPY = {
  eyebrow: "I tuoi dati",
  heading: "Il tuo orologio diventa un laboratorio",
  body: "Collega il tuo dispositivo Garmin, Polar o Wahoo. Empathy legge ogni battito, ogni watt, ogni metro e lo trasforma in analisi scientifiche per migliorare la tua performance.",
} as const;

/* =========================================================================
 * LIVE METRICS — realistic ranges, updated periodically
 * ========================================================================= */
type LiveMetrics = {
  hr: number; // bpm  120-175
  spd: number; // km/h 24.0-46.0
  pwr: number; // W    180-420
  cad: number; // rpm  70-105
};

const INITIAL_METRICS: LiveMetrics = {
  hr: 152,
  spd: 29.3,
  pwr: 284,
  cad: 88,
};

/* =========================================================================
 * SECTION
 * ========================================================================= */
type WatchLabSectionProps = {
  /** Anchor id — la home usa "piattaforma" (link navbar/hero). */
  id?: string;
  /** Variante compatta per pagine funnel (es. /access/plan): meno padding verticale. */
  compact?: boolean;
  eyebrow?: string;
  heading?: string;
  body?: string;
};

export function WatchLabSection({
  id = "piattaforma",
  compact = false,
  eyebrow = COPY.eyebrow,
  heading = COPY.heading,
  body = COPY.body,
}: WatchLabSectionProps = {}) {
  // Le metriche arrivano dall'animazione (AthleteCanvas) → l'orologio mostra
  // ESATTAMENTE gli stessi valori della bici/atleta, non un ticker separato.
  const [metrics, setMetrics] = useState<LiveMetrics>(INITIAL_METRICS);

  return (
    <section
      id={id}
      className={`relative mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6 lg:px-8 ${
        compact ? "py-8 sm:py-10" : "py-16 sm:py-24"
      }`}
    >
      <div className="grid items-center gap-10 lg:grid-cols-2">
        {/* LEFT COLUMN */}
        <div className="flex flex-col">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-purple-200 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
            {eyebrow}
          </span>

          <h2 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {heading}
          </h2>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-300">
            {body}
          </p>

          {/* Smartwatch graphic with live metrics */}
          <div className="mt-8 flex justify-center sm:justify-start">
            <Smartwatch metrics={metrics} />
          </div>
        </div>

        {/* RIGHT COLUMN — animation */}
        <div className="order-last flex w-full justify-center lg:order-none">
          <div className="w-full max-w-2xl">
            <AthleteCanvas onMetrics={setMetrics} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
 * SMARTWATCH — CSS/SVG stylized watch, on-brand, live face
 * ========================================================================= */
function Smartwatch({ metrics }: { metrics: LiveMetrics }) {
  return (
    <div className="relative" aria-hidden="true">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -inset-8 rounded-full bg-gradient-to-tr from-purple-500/20 via-pink-500/15 to-orange-500/20 blur-3xl" />

      <div className="relative flex flex-col items-center">
        {/* Top band */}
        <div className="h-10 w-16 rounded-t-2xl bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-inset ring-white/10" />

        {/* Watch body */}
        <div className="relative -my-2 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/[0.03] p-2 shadow-2xl shadow-purple-500/30 ring-1 ring-white/15">
          {/* Crown */}
          <div className="absolute -right-1.5 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-r-md bg-gradient-to-b from-white/20 to-white/5" />

          {/* Face */}
          <div className="relative h-52 w-52 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/80 backdrop-blur-xl">
            {/* Face inner gradient sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-orange-500/10" />

            <div className="relative flex h-full flex-col justify-between p-4">
              {/* Top row: LIVE indicator + clock */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-pink-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400" />
                  Live
                </span>
                <Radio className="h-3 w-3 text-purple-300/70" />
              </div>

              {/* Primary metrics: HR + SPD */}
              <div className="space-y-2.5">
                <MetricLine
                  icon={<Activity className="h-3.5 w-3.5 text-pink-400" />}
                  label="HR"
                  value={metrics.hr.toString()}
                  unit="bpm"
                  accent="text-pink-300"
                />
                <MetricLine
                  icon={<Gauge className="h-3.5 w-3.5 text-orange-400" />}
                  label="SPD"
                  value={metrics.spd.toFixed(1)}
                  unit="km/h"
                  accent="text-orange-300"
                />
              </div>

              {/* Secondary metrics: PWR + CAD */}
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <div className="flex flex-col">
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-gray-500">
                    PWR
                  </span>
                  <span className="font-mono text-sm font-bold text-purple-200">
                    {metrics.pwr}
                    <span className="ml-0.5 text-[0.55rem] font-normal text-gray-500">
                      W
                    </span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-gray-500">
                    CAD
                  </span>
                  <span className="font-mono text-sm font-bold text-purple-200">
                    {metrics.cad}
                    <span className="ml-0.5 text-[0.55rem] font-normal text-gray-500">
                      rpm
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom band */}
        <div className="h-10 w-16 rounded-b-2xl bg-gradient-to-t from-white/10 to-white/5 ring-1 ring-inset ring-white/10" />
      </div>
    </div>
  );
}

function MetricLine({
  icon,
  label,
  value,
  unit,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex w-12 items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-gray-400">
        {icon}
        {label}
      </span>
      <span
        className={`font-mono text-2xl font-black tabular-nums tracking-tight ${accent}`}
      >
        {value}
      </span>
      <span className="font-mono text-[0.6rem] text-gray-500">{unit}</span>
    </div>
  );
}
