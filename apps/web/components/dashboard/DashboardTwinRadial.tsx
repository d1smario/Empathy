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
 * luminanza SVG (lo sfondo nero sparisce → si vedono gli anelli dietro).
 * Attorno: anelli orbitali, linee di collegamento e i 9 contatori-area come
 * badge HTML (icona lucide in anello con glow + score + stato). Posizioni in %
 * allineate al viewBox 680×540.
 */

const VB_W = 680;
const VB_H = 540;
// Riquadro del corpo nel viewBox (l'immagine è 1080×1920, ratio ~0.5625).
const BODY = { x: 210, y: 30, w: 260, h: 480 };

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
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="36%" stopColor="#ec4899" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id="twinUplight" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#7c3aed" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="twinPlatform" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
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
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>{`@keyframes twinBreathe{0%,100%{opacity:.86}50%{opacity:1}}.twin-breathe{animation:twinBreathe 5.5s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.twin-breathe{animation:none}}`}</style>

        <ellipse cx="340" cy="505" rx="240" ry="180" fill="url(#twinUplight)" />
        <g fill="none" stroke="#5eead4" opacity="0.12">
          <circle cx="340" cy="300" r="118" />
          <circle cx="340" cy="300" r="170" />
          <circle cx="340" cy="300" r="222" />
        </g>
        <ellipse cx="340" cy="504" rx="130" ry="28" fill="url(#twinPlatform)" />

        {SLOT_KEYS.map((k) => {
          const s = SLOTS[k];
          const a = byKey.get(k);
          const on = Boolean(a?.hasData && a?.score != null);
          return (
            <line
              key={`c-${k}`}
              x1={(s.bx / 100) * VB_W}
              y1={(s.by / 100) * VB_H}
              x2={s.anchor.x}
              y2={s.anchor.y}
              stroke={s.color}
              strokeWidth={1}
              opacity={on ? 0.4 : 0.14}
            />
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
        <ellipse cx="340" cy="506" rx="40" ry="12" fill="url(#twinPlatform)" opacity="0.8" />
        <circle cx="340" cy="505" r="3" fill="#ffffff" filter="url(#twinGlow)" />
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
            <div className={`truncate font-mono ${labelCls} uppercase tracking-wider`} style={{ color: s.color, opacity: on ? 0.9 : 0.6 }}>
              {a?.label ?? k}
            </div>
            <div
              className={`mx-auto mt-0.5 flex ${ringCls} items-center justify-center rounded-full border-2 bg-black/70`}
              style={{ borderColor: s.color, opacity: on ? 1 : 0.5, boxShadow: on ? `0 0 14px -3px ${s.color}` : undefined }}
            >
              <Icon size={iconSz} style={{ color: s.color }} aria-hidden />
            </div>
            <div className={`${scoreCls} font-bold leading-tight tabular-nums`} style={{ color: on ? "#ffffff" : "#6b7280" }}>
              {on ? Math.round(a!.score as number) : "—"}
            </div>
            <div className={`${statusCls} leading-tight`} style={{ color: on ? s.color : "#6b7280" }}>
              {statusText(a, on)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
