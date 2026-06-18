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
 * Centro dashboard: umanoide wireframe a point-cloud DENSO (SVG, ~620 punti
 * deterministici, gradiente brand) con anelli orbitali e linee di collegamento,
 * e i 9 contatori-area come badge HTML sovrapposti (icona lucide in anello con
 * glow + score + stato). Posizioni in % allineate al viewBox 680×540.
 */

type P = { x: number; y: number };

function rnd(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function bone(ax: number, ay: number, bx: number, by: number, count: number, jitter: number, seed: number): P[] {
  const out: P[] = [];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const o = (rnd(seed + i * 1.7) - 0.5) * jitter * 2;
    const al = (rnd(seed + i * 0.3 + 5) - 0.5) * 3;
    out.push({ x: ax + dx * t + px * o + (dx / len) * al, y: ay + dy * t + py * o + (dy / len) * al });
  }
  return out;
}
function fe(cx: number, cy: number, rx: number, ry: number, count: number, seed: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd(seed + i * 2.1) * Math.PI * 2;
    const r = Math.sqrt(rnd(seed + i * 1.3 + 9));
    out.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  }
  return out;
}
function fq(p1: P, p2: P, p3: P, p4: P, count: number, seed: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < count; i++) {
    const u = rnd(seed + i * 1.9);
    const v = rnd(seed + i * 0.7 + 3);
    const top = { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u };
    const bot = { x: p4.x + (p3.x - p4.x) * u, y: p4.y + (p3.y - p4.y) * u };
    out.push({ x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v });
  }
  return out;
}

const J = {
  neck: { x: 340, y: 176 },
  shL: { x: 300, y: 194 },
  shR: { x: 380, y: 194 },
  elL: { x: 284, y: 262 },
  elR: { x: 396, y: 262 },
  haL: { x: 298, y: 326 },
  haR: { x: 382, y: 326 },
  hpL: { x: 320, y: 312 },
  hpR: { x: 360, y: 312 },
  knL: { x: 324, y: 398 },
  knR: { x: 356, y: 398 },
  anL: { x: 322, y: 476 },
  anR: { x: 358, y: 476 },
  ftL: { x: 305, y: 490 },
  ftR: { x: 375, y: 490 },
};

const BODY_DOTS: P[] = [
  ...fe(340, 142, 18, 21, 70, 1),
  ...bone(340, 160, 340, 304, 26, 8, 100),
  ...bone(J.shL.x, J.shL.y, J.shR.x, J.shR.y, 20, 5, 200),
  ...fq(J.shL, J.shR, J.hpR, J.hpL, 175, 300),
  ...bone(J.shL.x, J.shL.y, J.elL.x, J.elL.y, 22, 6, 400),
  ...bone(J.shR.x, J.shR.y, J.elR.x, J.elR.y, 22, 6, 450),
  ...bone(J.elL.x, J.elL.y, J.haL.x, J.haL.y, 22, 5, 500),
  ...bone(J.elR.x, J.elR.y, J.haR.x, J.haR.y, 22, 5, 550),
  ...fe(J.haL.x, J.haL.y, 8, 9, 16, 560),
  ...fe(J.haR.x, J.haR.y, 8, 9, 16, 575),
  ...bone(J.hpL.x, J.hpL.y, J.hpR.x, J.hpR.y, 16, 5, 600),
  ...bone(J.hpL.x, J.hpL.y, J.knL.x, J.knL.y, 30, 9, 650),
  ...bone(J.hpR.x, J.hpR.y, J.knR.x, J.knR.y, 30, 9, 700),
  ...bone(J.knL.x, J.knL.y, J.anL.x, J.anL.y, 28, 7, 750),
  ...bone(J.knR.x, J.knR.y, J.anR.x, J.anR.y, 28, 7, 800),
  ...bone(J.anL.x, J.anL.y, J.ftL.x, J.ftL.y, 10, 4, 850),
  ...bone(J.anR.x, J.anR.y, J.ftR.x, J.ftR.y, 10, 4, 870),
];

type Slot = { color: string; icon: LucideIcon; bx: number; by: number; anchor: P };
const VB_W = 680;
const VB_H = 540;
const SLOTS: Record<DashboardAreaKey, Slot> = {
  performance: { color: "#ec4899", icon: Activity, bx: 50, by: 7, anchor: { x: 340, y: 120 } },
  stress: { color: "#a855f7", icon: Zap, bx: 20, by: 24, anchor: J.shL },
  biomarkers: { color: "#f59e0b", icon: FlaskConical, bx: 14, by: 44, anchor: J.elL },
  nutrition: { color: "#84cc16", icon: Apple, bx: 16, by: 64, anchor: J.hpL },
  microbiome: { color: "#f472b6", icon: Bug, bx: 24, by: 84, anchor: J.knL },
  recovery: { color: "#8b5cf6", icon: BatteryCharging, bx: 80, by: 24, anchor: J.shR },
  sleep: { color: "#3b82f6", icon: Moon, bx: 86, by: 44, anchor: J.elR },
  hormones: { color: "#14b8a6", icon: Flame, bx: 84, by: 64, anchor: J.hpR },
  longevity: { color: "#f97316", icon: InfinityIcon, bx: 76, by: 84, anchor: J.knR },
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

export function DashboardTwinRadial({ areas }: { areas: DashboardArea[] }) {
  const byKey = new Map(areas.map((a) => [a.key, a]));
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
        </defs>
        <style>{`@keyframes twinBreathe{0%,100%{opacity:.82}50%{opacity:1}}.twin-breathe{animation:twinBreathe 5.5s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.twin-breathe{animation:none}}`}</style>
        <g fill="none" stroke="#5eead4" opacity="0.1">
          <circle cx="340" cy="300" r="118" />
          <circle cx="340" cy="300" r="170" />
          <circle cx="340" cy="300" r="222" />
        </g>
        <ellipse cx="340" cy="500" rx="62" ry="8" fill="#22d3ee" opacity="0.12" />
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
        <g className="twin-breathe" fill="url(#twinGrad)">
          {BODY_DOTS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={1.7} />
          ))}
        </g>
      </svg>

      {SLOT_KEYS.map((k) => {
        const s = SLOTS[k];
        const a = byKey.get(k);
        const on = Boolean(a?.hasData && a?.score != null);
        const Icon = s.icon;
        return (
          <div
            key={`b-${k}`}
            className="absolute w-24 -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${s.bx}%`, top: `${s.by}%` }}
          >
            <div className="truncate font-mono text-[0.55rem] uppercase tracking-wider" style={{ color: s.color, opacity: on ? 0.9 : 0.6 }}>
              {a?.label ?? k}
            </div>
            <div
              className="mx-auto mt-0.5 flex h-11 w-11 items-center justify-center rounded-full border-2 bg-black/70"
              style={{ borderColor: s.color, opacity: on ? 1 : 0.5, boxShadow: on ? `0 0 14px -3px ${s.color}` : undefined }}
            >
              <Icon size={19} style={{ color: s.color }} aria-hidden />
            </div>
            <div className="text-lg font-bold leading-tight tabular-nums" style={{ color: on ? "#ffffff" : "#6b7280" }}>
              {on ? Math.round(a!.score as number) : "—"}
            </div>
            <div className="text-[0.6rem] leading-tight" style={{ color: on ? s.color : "#6b7280" }}>
              {statusText(a, on)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
