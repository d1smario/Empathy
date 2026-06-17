"use client";

import type { DashboardArea, DashboardAreaKey } from "@/lib/dashboard/dashboard-scores";

/**
 * Centro della dashboard: umanoide wireframe a point-cloud DENSO (centinaia di
 * punti, gradiente brand) con anelli orbitali e i 9 contatori-area piccoli
 * disposti ad arco, collegati al corpo da linee sottili. SVG deterministico
 * (niente canvas, niente Math.random → nessun mismatch SSR).
 */

type P = { x: number; y: number };

// PRNG deterministico (hash sinusoidale) — stabile tra server e client.
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
    const off = (rnd(seed + i * 1.7) - 0.5) * jitter * 2;
    const along = (rnd(seed + i * 0.3 + 5) - 0.5) * 3;
    out.push({ x: ax + dx * t + px * off + (dx / len) * along, y: ay + dy * t + py * off + (dy / len) * along });
  }
  return out;
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, count: number, seed: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd(seed + i * 2.1) * Math.PI * 2;
    const r = Math.sqrt(rnd(seed + i * 1.3 + 9));
    out.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  }
  return out;
}

function fillQuad(p1: P, p2: P, p3: P, p4: P, count: number, seed: number): P[] {
  // bilinear sampling: p1=TL, p2=TR, p3=BR, p4=BL
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

// Scheletro (viewBox 680×470, corpo centrato a x≈340).
const J = {
  neck: { x: 340, y: 124 },
  shL: { x: 300, y: 140 },
  shR: { x: 380, y: 140 },
  elL: { x: 284, y: 205 },
  elR: { x: 396, y: 205 },
  haL: { x: 300, y: 266 },
  haR: { x: 380, y: 266 },
  waist: { x: 340, y: 238 },
  hpL: { x: 320, y: 248 },
  hpR: { x: 360, y: 248 },
  knL: { x: 324, y: 328 },
  knR: { x: 356, y: 328 },
  anL: { x: 322, y: 402 },
  anR: { x: 358, y: 402 },
  ftL: { x: 305, y: 416 },
  ftR: { x: 375, y: 416 },
};

const BODY_DOTS: P[] = [
  ...fillEllipse(340, 92, 19, 22, 60, 1),
  ...bone(J.neck.x, J.neck.y, J.waist.x, J.waist.y, 22, 9, 100),
  ...bone(J.shL.x, J.shL.y, J.shR.x, J.shR.y, 18, 5, 200),
  ...fillQuad(J.shL, J.shR, J.hpR, J.hpL, 150, 300),
  ...bone(J.shL.x, J.shL.y, J.elL.x, J.elL.y, 20, 6, 400),
  ...bone(J.shR.x, J.shR.y, J.elR.x, J.elR.y, 20, 6, 450),
  ...bone(J.elL.x, J.elL.y, J.haL.x, J.haL.y, 20, 5, 500),
  ...bone(J.elR.x, J.elR.y, J.haR.x, J.haR.y, 20, 5, 550),
  ...fillEllipse(J.haL.x, J.haL.y, 8, 9, 14, 560),
  ...fillEllipse(J.haR.x, J.haR.y, 8, 9, 14, 580),
  ...bone(J.hpL.x, J.hpL.y, J.hpR.x, J.hpR.y, 14, 5, 600),
  ...bone(J.hpL.x, J.hpL.y, J.knL.x, J.knL.y, 28, 9, 650),
  ...bone(J.hpR.x, J.hpR.y, J.knR.x, J.knR.y, 28, 9, 700),
  ...bone(J.knL.x, J.knL.y, J.anL.x, J.anL.y, 26, 7, 750),
  ...bone(J.knR.x, J.knR.y, J.anR.x, J.anR.y, 26, 7, 800),
  ...bone(J.anL.x, J.anL.y, J.ftL.x, J.ftL.y, 10, 4, 850),
  ...bone(J.anR.x, J.anR.y, J.ftR.x, J.ftR.y, 10, 4, 870),
];

type Slot = { cx: number; cy: number; color: string; to: P };
const SLOTS: Record<DashboardAreaKey, Slot> = {
  performance: { cx: 340, cy: 40, color: "#ec4899", to: { x: 340, y: 72 } },
  stress: { cx: 150, cy: 118, color: "#a855f7", to: J.shL },
  biomarkers: { cx: 118, cy: 205, color: "#f59e0b", to: J.elL },
  nutrition: { cx: 128, cy: 295, color: "#84cc16", to: J.hpL },
  microbiome: { cx: 165, cy: 378, color: "#ec4899", to: J.knL },
  recovery: { cx: 530, cy: 118, color: "#8b5cf6", to: J.shR },
  sleep: { cx: 562, cy: 205, color: "#3b82f6", to: J.elR },
  hormones: { cx: 552, cy: 295, color: "#14b8a6", to: J.hpR },
  longevity: { cx: 515, cy: 378, color: "#f97316", to: J.knR },
};

function statusLabel(a: DashboardArea): string {
  if (!a.hasData || a.score == null) return "in attesa";
  if (a.status === "ottimale") return "Ottimale";
  if (a.status === "buona") return "Buona";
  if (a.status === "attenzione") return "Attenzione";
  if (a.status === "bassa") return a.higherIsBetter ? "Bassa" : "Ottimale";
  return "";
}

export function DashboardTwinRadial({ areas }: { areas: DashboardArea[] }) {
  const byKey = new Map(areas.map((a) => [a.key, a]));
  return (
    <svg viewBox="0 0 680 470" className="mx-auto h-auto w-full max-w-3xl" role="img" aria-label="Stato corpo: punteggi per area">
      <defs>
        <linearGradient id="twinGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="38%" stopColor="#ec4899" />
          <stop offset="72%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      <g fill="none" stroke="#5eead4" opacity="0.1">
        <circle cx="340" cy="250" r="110" />
        <circle cx="340" cy="250" r="162" />
        <circle cx="340" cy="250" r="214" />
      </g>
      <ellipse cx="340" cy="430" rx="64" ry="8" fill="#22d3ee" opacity="0.12" />

      {/* connettori corpo ↔ badge */}
      {(Object.keys(SLOTS) as DashboardAreaKey[]).map((k) => {
        const s = SLOTS[k];
        const a = byKey.get(k);
        const on = Boolean(a?.hasData && a?.score != null);
        return (
          <line
            key={`c-${k}`}
            x1={s.cx}
            y1={s.cy}
            x2={s.to.x}
            y2={s.to.y}
            stroke={s.color}
            strokeWidth={1}
            opacity={on ? 0.4 : 0.15}
          />
        );
      })}

      {/* corpo a point-cloud denso */}
      <g fill="url(#twinGrad)">
        {BODY_DOTS.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.7} />
        ))}
      </g>

      {/* badge area */}
      {(Object.keys(SLOTS) as DashboardAreaKey[]).map((k) => {
        const s = SLOTS[k];
        const a = byKey.get(k);
        const label = (a?.label ?? k).toUpperCase();
        const on = Boolean(a?.hasData && a?.score != null);
        return (
          <g key={`b-${k}`} textAnchor="middle">
            <text x={s.cx} y={s.cy - 28} fill="#9aa0ae" fontFamily="monospace" fontSize="9" letterSpacing="0.5">
              {label}
            </text>
            <circle cx={s.cx} cy={s.cy} r="21" fill="#0b0b14" stroke={s.color} strokeWidth={on ? 1.8 : 1} opacity={on ? 1 : 0.55} />
            <text x={s.cx} y={s.cy + 6} fill={on ? "#ffffff" : "#6b7280"} fontFamily="sans-serif" fontSize={on ? "17" : "14"} fontWeight="700">
              {on ? Math.round(a!.score as number) : "—"}
            </text>
            <text x={s.cx} y={s.cy + 38} fill={on ? s.color : "#6b7280"} fontFamily="sans-serif" fontSize="10">
              {statusLabel(a ?? ({ key: k, hasData: false, score: null } as unknown as DashboardArea))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
