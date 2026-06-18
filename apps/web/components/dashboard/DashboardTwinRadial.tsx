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
 * empathy-twin-body.png) RICOLORATA col gradiente brand via maschera di
 * luminanza SVG. Attorno: backdrop HUD/radar (anelli concentrici, tacche, anelli
 * tratteggiati rotanti, campo particellare), luce dal basso sfumata (gradienti
 * multi-stop + blur, niente stacchi) e i 9 contatori-area come badge HTML.
 * Posizioni badge in % allineate al viewBox 680×540.
 */

const VB_W = 680;
const VB_H = 540;
// Riquadro del corpo nel viewBox (l'immagine è 1080×1920, ratio ~0.5625).
// Compatto verso l'alto: corpo + luce + anelli stanno tutti dentro il viewBox 540
// (niente taglio in basso), umanoide vicino alla fonte di luce ai piedi.
const BODY = { x: 223, y: 52, w: 234, h: 416 };
// Centro del radar (centro corpo).
const CX = 340;
const CY = 282;

type Anchor = { x: number; y: number };
type Slot = { color: string; icon: LucideIcon; bx: number; by: number; anchor: Anchor };

const SLOTS: Record<DashboardAreaKey, Slot> = {
  performance: { color: "#ec4899", icon: Activity, bx: 50, by: 7, anchor: { x: 340, y: 95 } },
  stress: { color: "#a855f7", icon: Zap, bx: 20, by: 24, anchor: { x: 300, y: 165 } },
  biomarkers: { color: "#f59e0b", icon: FlaskConical, bx: 14, by: 44, anchor: { x: 280, y: 245 } },
  nutrition: { color: "#84cc16", icon: Apple, bx: 16, by: 64, anchor: { x: 318, y: 285 } },
  microbiome: { color: "#f472b6", icon: Bug, bx: 24, by: 84, anchor: { x: 326, y: 390 } },
  recovery: { color: "#8b5cf6", icon: BatteryCharging, bx: 80, by: 24, anchor: { x: 380, y: 165 } },
  sleep: { color: "#3b82f6", icon: Moon, bx: 86, by: 44, anchor: { x: 400, y: 245 } },
  hormones: { color: "#14b8a6", icon: Flame, bx: 84, by: 64, anchor: { x: 362, y: 285 } },
  longevity: { color: "#f97316", icon: InfinityIcon, bx: 76, by: 84, anchor: { x: 354, y: 390 } },
};
const SLOT_KEYS = Object.keys(SLOTS) as DashboardAreaKey[];

// Campo particellare deterministico (no Math.random → coerente SSR/hydration):
// spirale a passo "aureo" attorno al centro, colori dal gradiente brand.
const DOT_PALETTE = ["#a78bfa", "#ec4899", "#fb923c", "#22d3ee", "#5eead4", "#60a5fa", "#f472b6", "#facc15"];
const RADAR_DOTS = Array.from({ length: 44 }, (_, i) => {
  const a = i * 137.5 * (Math.PI / 180);
  const r = 96 + ((i * 57) % 148);
  return {
    x: CX + r * Math.cos(a),
    y: CY + r * Math.sin(a),
    s: 0.7 + (i % 3) * 0.55,
    c: DOT_PALETTE[i % DOT_PALETTE.length],
    o: 0.28 + (i % 5) * 0.11,
  };
});

// Tacche radiali sull'anello esterno (look radar/compasso).
const RADAR_TICKS = Array.from({ length: 24 }, (_, i) => {
  const a = i * 15 * (Math.PI / 180);
  const rOut = 228;
  const rIn = i % 2 === 0 ? 216 : 222;
  return {
    x1: CX + rOut * Math.cos(a),
    y1: CY + rOut * Math.sin(a),
    x2: CX + rIn * Math.cos(a),
    y2: CY + rIn * Math.sin(a),
  };
});

function statusText(a: DashboardArea | undefined, on: boolean): string {
  if (!on || !a) return "in attesa";
  if (a.status === "ottimale") return "Ottimale";
  if (a.status === "buona") return "Buona";
  if (a.status === "attenzione") return "Attenzione";
  if (a.status === "bassa") return a.higherIsBetter ? "Bassa" : "Ottimale";
  return "";
}

export function DashboardTwinRadial({
  areas,
  badgeSize = "md",
}: {
  areas: DashboardArea[];
  badgeSize?: "sm" | "md";
}) {
  const byKey = new Map(areas.map((a) => [a.key, a]));
  const sm = badgeSize === "sm";
  const wCls = sm ? "w-16" : "w-24";
  const ringCls = sm ? "h-8 w-8" : "h-11 w-11";
  const iconSz = sm ? 15 : 19;
  const labelCls = sm ? "text-[0.5rem]" : "text-[0.55rem]";
  const scoreCls = sm ? "text-sm" : "text-lg";
  const statusCls = sm ? "text-[0.52rem]" : "text-[0.6rem]";
  return (
    <div className="relative mx-auto w-full max-w-3xl" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="twinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="30%" stopColor="#ec4899" />
            <stop offset="60%" stopColor="#fb7a3c" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          {/* Halo colore dietro il corpo (alone caldo/freddo diffuso). */}
          <radialGradient id="twinAura" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.16" />
            <stop offset="45%" stopColor="#8b5cf6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          {/* Luce dal basso: molti stop con calo dolce fino a 0 → niente bordo netto. */}
          <radialGradient id="twinUplight" cx="50%" cy="50%" r="72%">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.5" />
            <stop offset="22%" stopColor="#a78bfa" stopOpacity="0.34" />
            <stop offset="48%" stopColor="#7c3aed" stopOpacity="0.16" />
            <stop offset="74%" stopColor="#6d28d9" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          {/* Piattaforma luminosa ai piedi: core brillante che sfuma su ciano. */}
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
            <image
              href="/brand/empathy-twin-body.png"
              x={BODY.x}
              y={BODY.y}
              width={BODY.w}
              height={BODY.h}
              preserveAspectRatio="xMidYMid meet"
            />
          </mask>
          <filter id="twinGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Blur ampio per le luci: elimina ogni stacco netto dei bordi. */}
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
          .twin-spin{transform-origin:${CX}px ${CY}px;animation:twinSpin 48s linear infinite}
          .twin-spin-rev{transform-origin:${CX}px ${CY}px;animation:twinSpinRev 72s linear infinite}
          .twin-twinkle{animation:twinTwinkle 4.5s ease-in-out infinite}
          @media(prefers-reduced-motion:reduce){.twin-breathe,.twin-spin,.twin-spin-rev,.twin-twinkle{animation:none}}
        `}</style>

        {/* Alone colore + luce dal basso (sfumati con blur ampio) */}
        <ellipse cx={CX} cy="232" rx="236" ry="224" fill="url(#twinAura)" filter="url(#softBlur)" />
        <ellipse cx={CX} cy="466" rx="236" ry="72" fill="url(#twinUplight)" filter="url(#softBlur)" />

        {/* Backdrop HUD / radar */}
        <g fill="none">
          <circle cx={CX} cy={CY} r="78" stroke="#5eead4" strokeWidth="0.6" opacity="0.16" />
          <circle cx={CX} cy={CY} r="116" stroke="#8b5cf6" strokeWidth="0.6" opacity="0.13" />
          <circle cx={CX} cy={CY} r="156" stroke="#5eead4" strokeWidth="0.6" opacity="0.1" />
          <circle cx={CX} cy={CY} r="198" stroke="#8b5cf6" strokeWidth="0.6" opacity="0.08" />
          <circle cx={CX} cy={CY} r="238" stroke="url(#twinRing)" strokeWidth="0.8" opacity="0.2" />
          <line x1={CX} y1="48" x2={CX} y2="520" stroke="#a78bfa" strokeWidth="0.5" opacity="0.06" />
          <line x1="86" y1={CY} x2="594" y2={CY} stroke="#a78bfa" strokeWidth="0.5" opacity="0.06" />
          <circle className="twin-spin" cx={CX} cy={CY} r="222" stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="2 11" opacity="0.32" />
          <circle className="twin-spin-rev" cx={CX} cy={CY} r="186" stroke="#f472b6" strokeWidth="0.7" strokeDasharray="1 15" opacity="0.22" />
          {RADAR_TICKS.map((tk, i) => (
            <line key={`tk-${i}`} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2} stroke="#5eead4" strokeWidth="0.9" opacity="0.2" />
          ))}
        </g>

        {/* Campo particellare */}
        <g className="twin-twinkle">
          {RADAR_DOTS.map((d, i) => (
            <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.s} fill={d.c} opacity={d.o} />
          ))}
        </g>

        {/* Piattaforma luminosa ai piedi (sfumata, niente stacco) */}
        <ellipse cx={CX} cy="468" rx="148" ry="24" fill="url(#twinPlatform)" filter="url(#softBlur)" />

        {/* Connettori badge → corpo: tratteggiati + nodo luminoso sull'ancora */}
        {SLOT_KEYS.map((k) => {
          const s = SLOTS[k];
          const a = byKey.get(k);
          const on = Boolean(a?.hasData && a?.score != null);
          return (
            <g key={`c-${k}`}>
              <line
                x1={(s.bx / 100) * VB_W}
                y1={(s.by / 100) * VB_H}
                x2={s.anchor.x}
                y2={s.anchor.y}
                stroke={s.color}
                strokeWidth={1.1}
                strokeDasharray="1.5 5"
                opacity={on ? 0.6 : 0.34}
              />
              <circle cx={s.anchor.x} cy={s.anchor.y} r={on ? 2.6 : 2} fill={s.color} opacity={on ? 0.95 : 0.65} />
            </g>
          );
        })}

        {/* corpo X-ray ricolorato col gradiente brand (maschera di luminanza) */}
        <rect
          className="twin-breathe"
          x={BODY.x}
          y={BODY.y}
          width={BODY.w}
          height={BODY.h}
          fill="url(#twinGrad)"
          mask="url(#twinBodyMask)"
          filter="url(#twinGlow)"
        />
        {/* Burst di luce centrale ai piedi */}
        <ellipse cx={CX} cy="468" rx="46" ry="12" fill="url(#twinPlatform)" opacity="0.9" />
        <circle cx={CX} cy="466" r="3.4" fill="#ffffff" filter="url(#twinGlow)" />
      </svg>

      {SLOT_KEYS.map((k) => {
        const s = SLOTS[k];
        const a = byKey.get(k);
        const on = Boolean(a?.hasData && a?.score != null);
        const Icon = s.icon;
        return (
          <div
            key={`b-${k}`}
            className={`absolute ${wCls} -translate-x-1/2 -translate-y-1/2 text-center`}
            style={{ left: `${s.bx}%`, top: `${s.by}%` }}
          >
            {/* Ring, icona ed etichetta SEMPRE luminosi (come il badge "acceso"):
                lo stato dei dati si legge solo dal punteggio ("—" finché assente) e
                dallo stato ("in attesa"), che restano comunque leggibili. */}
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
            <div
              className={`${statusCls} leading-tight`}
              style={{ color: on ? s.color : "#cbd5e1", opacity: on ? 1 : 0.85 }}
            >
              {statusText(a, on)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
