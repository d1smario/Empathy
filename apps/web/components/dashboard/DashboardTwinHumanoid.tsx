"use client";

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

export const VB_W = 680;
export const VB_H = 540;

export type DashboardTwinHumanoidProps = {
  className?: string;
};

export function DashboardTwinHumanoid({ className }: DashboardTwinHumanoidProps) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "h-full w-full"}
      aria-hidden
    >
      <defs>
        <linearGradient id="twinGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="28%" stopColor="#ec4899" />
          <stop offset="52%" stopColor="#f97316" />
          <stop offset="76%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#5eead4" opacity="0.1">
        <circle cx="340" cy="300" r="118" />
        <circle cx="340" cy="300" r="170" />
        <circle cx="340" cy="300" r="222" />
      </g>
      <ellipse cx="340" cy="500" rx="62" ry="8" fill="#22d3ee" opacity="0.12" />
      <g className="animate-empathy-twin-breathe motion-reduce:animate-none" fill="url(#twinGrad)">
        {BODY_DOTS.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.7} />
        ))}
      </g>
    </svg>
  );
}
