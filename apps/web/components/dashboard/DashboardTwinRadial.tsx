"use client";

import {
  Activity,
  Apple,
  BatteryCharging,
  Bug,
  Flame,
  FlaskConical,
  Infinity as InfinityIcon,
  Moon,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { DashboardArea, DashboardAreaKey } from "@/lib/dashboard/dashboard-scores";

/**
 * Centro dashboard: corpo "digital twin" = immagine X-ray (public/brand/
 * empathy-twin-body.png) RICOLORATA col gradiente brand via maschera di luminanza SVG.
 * Attorno: backdrop HUD/radar (anelli concentrici, tacche, anelli tratteggiati rotanti,
 * campo particellare), luce dal basso e i 9 contatori-area come badge HTML, collegati al
 * corpo da connettori tratteggiati.
 *
 * Due layout, STESSA struttura (il contenitore ha lo stesso aspect-ratio del viewBox, così
 * i badge HTML e i connettori SVG restano allineati):
 *  - landscape (680×540): desktop.
 *  - portrait (660×720): mobile — disposizione più circolare, corpo centrato, badge con
 *    respiro verticale (niente sovrapposizioni). I connettori RESTANO (allineati).
 */

type Anchor = { x: number; y: number };
type SlotPos = { bx: number; by: number; anchor: Anchor };
type TwinLayout = {
  vbW: number;
  vbH: number;
  body: { x: number; y: number; w: number; h: number };
  cx: number;
  cy: number;
  feetY: number;
  auraY: number;
  vLine: { y1: number; y2: number };
  hLine: { x1: number; x2: number };
  pos: Record<DashboardAreaKey, SlotPos>;
};

const SLOT_META: Record<DashboardAreaKey, { color: string; icon: LucideIcon }> = {
  performance: { color: "#ec4899", icon: Activity },
  stress: { color: "#a855f7", icon: Zap },
  biomarkers: { color: "#f59e0b", icon: FlaskConical },
  nutrition: { color: "#84cc16", icon: Apple },
  microbiome: { color: "#f472b6", icon: Bug },
  recovery: { color: "#8b5cf6", icon: BatteryCharging },
  sleep: { color: "#3b82f6", icon: Moon },
  hormones: { color: "#14b8a6", icon: Flame },
  longevity: { color: "#f97316", icon: InfinityIcon },
};
const SLOT_KEYS = Object.keys(SLOT_META) as DashboardAreaKey[];

const LANDSCAPE: TwinLayout = {
  vbW: 680,
  vbH: 540,
  body: { x: 223, y: 52, w: 234, h: 416 },
  cx: 340,
  cy: 282,
  feetY: 466,
  auraY: 232,
  vLine: { y1: 48, y2: 520 },
  hLine: { x1: 86, x2: 594 },
  pos: {
    performance: { bx: 50, by: 7, anchor: { x: 340, y: 95 } },
    stress: { bx: 20, by: 24, anchor: { x: 300, y: 165 } },
    biomarkers: { bx: 14, by: 44, anchor: { x: 280, y: 245 } },
    nutrition: { bx: 16, by: 64, anchor: { x: 318, y: 285 } },
    microbiome: { bx: 24, by: 84, anchor: { x: 326, y: 390 } },
    recovery: { bx: 80, by: 24, anchor: { x: 380, y: 165 } },
    sleep: { bx: 86, by: 44, anchor: { x: 400, y: 245 } },
    hormones: { bx: 84, by: 64, anchor: { x: 362, y: 285 } },
    longevity: { bx: 76, by: 84, anchor: { x: 354, y: 390 } },
  },
};

// Portrait: corpo centrato (cy 360) e 9 badge su un cerchio attorno → forma "rotonda",
// performance in alto ma non troppo (10%), respiro verticale per le etichette.
const PORTRAIT: TwinLayout = {
  vbW: 660,
  vbH: 720,
  // Corpo ingrandito ~15% e ricentrato (cx330/cy360): la silhouette raggiunge i nodi
  // dei connettori, così i puntini "toccano" la figura invece di restarne fuori.
  body: { x: 196, y: 121, w: 269, h: 478 },
  cx: 330,
  cy: 360,
  feetY: 599,
  auraY: 360,
  vLine: { y1: 124, y2: 612 },
  hLine: { x1: 92, x2: 568 },
  pos: {
    performance: { bx: 50, by: 10, anchor: { x: 330, y: 178 } },
    stress: { bx: 23, by: 19, anchor: { x: 294, y: 240 } },
    recovery: { bx: 77, by: 19, anchor: { x: 366, y: 240 } },
    biomarkers: { bx: 9, by: 43, anchor: { x: 298, y: 320 } },
    sleep: { bx: 91, by: 43, anchor: { x: 362, y: 320 } },
    nutrition: { bx: 14, by: 70, anchor: { x: 306, y: 408 } },
    hormones: { bx: 86, by: 70, anchor: { x: 354, y: 408 } },
    microbiome: { bx: 36, by: 88, anchor: { x: 320, y: 492 } },
    longevity: { bx: 64, by: 88, anchor: { x: 348, y: 492 } },
  },
};

// Campo particellare deterministico (no Math.random): spirale a passo aureo attorno al centro.
const DOT_PALETTE = ["#a78bfa", "#ec4899", "#fb923c", "#22d3ee", "#5eead4", "#60a5fa", "#f472b6", "#facc15"];
function makeDots(cx: number, cy: number) {
  return Array.from({ length: 44 }, (_, i) => {
    const a = i * 137.5 * (Math.PI / 180);
    const r = 96 + ((i * 57) % 148);
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
      s: 0.7 + (i % 3) * 0.55,
      c: DOT_PALETTE[i % DOT_PALETTE.length],
      o: 0.28 + (i % 5) * 0.11,
    };
  });
}
function makeTicks(cx: number, cy: number) {
  return Array.from({ length: 24 }, (_, i) => {
    const a = i * 15 * (Math.PI / 180);
    const rOut = 228;
    const rIn = i % 2 === 0 ? 216 : 222;
    return {
      x1: cx + rOut * Math.cos(a),
      y1: cy + rOut * Math.sin(a),
      x2: cx + rIn * Math.cos(a),
      y2: cy + rIn * Math.sin(a),
    };
  });
}

function statusText(a: DashboardArea | undefined, on: boolean): string {
  if (!on || !a) return "Waiting";
  if (a.status === "ottimale") return "Optimal";
  if (a.status === "buona") return "Good";
  if (a.status === "attenzione") return "Attention";
  if (a.status === "bassa") return a.higherIsBetter ? "Low" : "Optimal";
  return "";
}

export function DashboardTwinRadial({
  areas,
  badgeSize = "md",
  portrait = false,
}: {
  areas: DashboardArea[];
  badgeSize?: "sm" | "md";
  /** Mobile: layout verticale/circolare (vedi PORTRAIT). */
  portrait?: boolean;
}) {
  const cfg = portrait ? PORTRAIT : LANDSCAPE;
  const { vbW, vbH, body, cx, cy, feetY, auraY } = cfg;
  const dots = makeDots(cx, cy);
  const ticks = makeTicks(cx, cy);

  const byKey = new Map(areas.map((a) => [a.key, a]));
  const sm = badgeSize === "sm";
  const wCls = sm ? "w-16" : "w-24";
  const ringCls = sm ? "h-8 w-8" : "h-11 w-11";
  const iconSz = sm ? 15 : 19;
  const labelCls = sm ? "text-[0.5rem]" : "text-[0.55rem]";
  const scoreCls = sm ? "text-sm" : "text-lg";
  const statusCls = sm ? "text-[0.52rem]" : "text-[0.6rem]";
  return (
    <div className="relative mx-auto w-full max-w-3xl" style={{ aspectRatio: `${vbW} / ${vbH}` }}>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="twinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="30%" stopColor="#ec4899" />
            <stop offset="60%" stopColor="#fb7a3c" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id="twinAura" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.16" />
            <stop offset="45%" stopColor="#8b5cf6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="twinUplight" cx="50%" cy="50%" r="72%">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.5" />
            <stop offset="22%" stopColor="#a78bfa" stopOpacity="0.34" />
            <stop offset="48%" stopColor="#7c3aed" stopOpacity="0.16" />
            <stop offset="74%" stopColor="#6d28d9" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="twinPlatform" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#f0e9ff" stopOpacity="0.95" />
            <stop offset="22%" stopColor="#c4b5fd" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="78%" stopColor="#22d3ee" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="twinRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
          <mask id="twinBodyMask">
            <image href="/brand/empathy-twin-body.png" x={body.x} y={body.y} width={body.w} height={body.h} preserveAspectRatio="xMidYMid meet" />
          </mask>
          <filter id="twinGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <style>{`
          @keyframes twinBreathe{0%,100%{opacity:.86}50%{opacity:1}}
          @keyframes twinSpin{to{transform:rotate(360deg)}}
          @keyframes twinSpinRev{to{transform:rotate(-360deg)}}
          @keyframes twinTwinkle{0%,100%{opacity:.45}50%{opacity:.9}}
          .twin-breathe{animation:twinBreathe 5.5s ease-in-out infinite}
          .twin-spin{transform-origin:${cx}px ${cy}px;animation:twinSpin 48s linear infinite}
          .twin-spin-rev{transform-origin:${cx}px ${cy}px;animation:twinSpinRev 72s linear infinite}
          .twin-twinkle{animation:twinTwinkle 4.5s ease-in-out infinite}
          @media(prefers-reduced-motion:reduce){.twin-breathe,.twin-spin,.twin-spin-rev,.twin-twinkle{animation:none}}
        `}</style>

        <ellipse cx={cx} cy={auraY} rx="236" ry={portrait ? 250 : 224} fill="url(#twinAura)" filter="url(#softBlur)" />
        <ellipse cx={cx} cy={feetY} rx="236" ry="72" fill="url(#twinUplight)" filter="url(#softBlur)" />

        <g fill="none">
          <circle cx={cx} cy={cy} r="78" stroke="#5eead4" strokeWidth="0.6" opacity="0.16" />
          <circle cx={cx} cy={cy} r="116" stroke="#8b5cf6" strokeWidth="0.6" opacity="0.13" />
          <circle cx={cx} cy={cy} r="156" stroke="#5eead4" strokeWidth="0.6" opacity="0.1" />
          <circle cx={cx} cy={cy} r="198" stroke="#8b5cf6" strokeWidth="0.6" opacity="0.08" />
          <circle cx={cx} cy={cy} r="238" stroke="url(#twinRing)" strokeWidth="0.8" opacity="0.2" />
          <line x1={cx} y1={cfg.vLine.y1} x2={cx} y2={cfg.vLine.y2} stroke="#a78bfa" strokeWidth="0.5" opacity="0.06" />
          <line x1={cfg.hLine.x1} y1={cy} x2={cfg.hLine.x2} y2={cy} stroke="#a78bfa" strokeWidth="0.5" opacity="0.06" />
          <circle className="twin-spin" cx={cx} cy={cy} r="222" stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="2 11" opacity="0.32" />
          <circle className="twin-spin-rev" cx={cx} cy={cy} r="186" stroke="#f472b6" strokeWidth="0.7" strokeDasharray="1 15" opacity="0.22" />
          {ticks.map((tk, i) => (
            <line key={`tk-${i}`} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2} stroke="#5eead4" strokeWidth="0.9" opacity="0.2" />
          ))}
        </g>

        <g className="twin-twinkle">
          {dots.map((d, i) => (
            <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.s} fill={d.c} opacity={d.o} />
          ))}
        </g>

        <ellipse cx={cx} cy={feetY + 2} rx="148" ry="24" fill="url(#twinPlatform)" filter="url(#softBlur)" />

        {/* Connettori badge → corpo: allineati perché il contenitore ha lo stesso aspect del viewBox. */}
        {SLOT_KEYS.map((k) => {
          const p = cfg.pos[k];
          const s = SLOT_META[k];
          const a = byKey.get(k);
          const on = Boolean(a?.hasData && a?.score != null);
          return (
            <g key={`c-${k}`}>
              <line
                x1={(p.bx / 100) * vbW}
                y1={(p.by / 100) * vbH}
                x2={p.anchor.x}
                y2={p.anchor.y}
                stroke={s.color}
                strokeWidth={1.1}
                strokeDasharray="1.5 5"
                opacity={on ? 0.6 : 0.34}
              />
              <circle cx={p.anchor.x} cy={p.anchor.y} r={on ? 2.6 : 2} fill={s.color} opacity={on ? 0.95 : 0.65} />
            </g>
          );
        })}

        <rect
          className="twin-breathe"
          x={body.x}
          y={body.y}
          width={body.w}
          height={body.h}
          fill="url(#twinGrad)"
          mask="url(#twinBodyMask)"
          filter="url(#twinGlow)"
        />
        <ellipse cx={cx} cy={feetY + 2} rx="46" ry="12" fill="url(#twinPlatform)" opacity="0.9" />
        <circle cx={cx} cy={feetY} r="3.4" fill="#ffffff" filter="url(#twinGlow)" />
      </svg>

      {SLOT_KEYS.map((k) => {
        const p = cfg.pos[k];
        const s = SLOT_META[k];
        const a = byKey.get(k);
        const on = Boolean(a?.hasData && a?.score != null);
        const Icon = s.icon;
        return (
          <div
            key={`b-${k}`}
            className={`absolute ${wCls} -translate-x-1/2 -translate-y-1/2 text-center`}
            style={{ left: `${p.bx}%`, top: `${p.by}%` }}
          >
            <div
              className={`truncate font-mono ${labelCls} uppercase tracking-wider`}
              style={{ color: s.color, opacity: 0.95, textShadow: `0 0 8px ${s.color}66` }}
            >
              {a?.label ?? k}
            </div>
            <div
              className={`mx-auto mt-0.5 flex ${ringCls} items-center justify-center rounded-full border-2`}
              style={{
                borderColor: s.color,
                backgroundColor: "rgba(0,0,0,0.5)",
                boxShadow: `0 0 24px -3px ${s.color}, 0 0 9px -2px ${s.color}, inset 0 0 12px -6px ${s.color}`,
              }}
            >
              <Icon size={iconSz} style={{ color: s.color, filter: `drop-shadow(0 0 5px ${s.color}aa)` }} aria-hidden />
            </div>
            <div
              className={`${scoreCls} font-bold leading-tight tabular-nums`}
              style={{
                color: on ? "#ffffff" : "#cbd5e1",
                textShadow: on ? "0 0 10px rgba(255,255,255,0.3)" : `0 0 8px ${s.color}55`,
              }}
            >
              {on ? Math.round(a!.score as number) : "—"}
            </div>
            <div className={`${statusCls} leading-tight`} style={{ color: on ? s.color : "#cbd5e1", opacity: on ? 1 : 0.85 }}>
              {statusText(a, on)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
