"use client";

/**
 * Omino "digital twin" SOLO figura: corpo X-ray (public/brand/empathy-twin-body.png)
 * ricolorato col gradiente brand via maschera di luminanza, respiro, luce dal basso
 * e piattaforma luminosa — SENZA anelli HUD, tacche, connettori e badge-contatori
 * (quelli restano in DashboardTwinRadial, vista «Analisi»). Attorno solo un campo
 * di stelline soft. Pensato come colonna d'impatto nella vista «Oggi».
 *
 * ID SVG prefissati `twinFig` per non collidere con DashboardTwinRadial se mai
 * montati nella stessa pagina.
 */

// Portrait stretto da colonna: stesso aspect del corpo (234×416 ≈ 0.5625).
const VB_W = 340;
const VB_H = 560;
const BODY = { x: 45, y: 42, w: 250, h: 444 };
const CX = 170;
const FEET_Y = 486;
const AURA_Y = 250;

// Stelline deterministiche (no Math.random): spirale a passo aureo attorno al corpo.
const DOT_PALETTE = ["#a78bfa", "#ec4899", "#fb923c", "#22d3ee", "#5eead4", "#60a5fa", "#f472b6", "#facc15"];
const DOTS = Array.from({ length: 30 }, (_, i) => {
  const a = i * 137.5 * (Math.PI / 180);
  const r = 84 + ((i * 53) % 112);
  return {
    x: CX + r * Math.cos(a),
    y: AURA_Y + r * 1.55 * Math.sin(a),
    s: 0.7 + (i % 3) * 0.5,
    c: DOT_PALETTE[i % DOT_PALETTE.length],
    o: 0.24 + (i % 5) * 0.1,
  };
}).filter((d) => d.x > 8 && d.x < VB_W - 8 && d.y > 10 && d.y < VB_H - 16);

export function TwinFigureArt({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-violet-950/25 via-black/40 to-black/70 ${className ?? ""}`}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto h-full w-full max-w-[300px] lg:max-w-none"
        aria-hidden
      >
        <defs>
          <linearGradient id="twinFigGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="30%" stopColor="#ec4899" />
            <stop offset="60%" stopColor="#fb7a3c" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id="twinFigAura" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.15" />
            <stop offset="45%" stopColor="#8b5cf6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="twinFigUplight" cx="50%" cy="50%" r="72%">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.5" />
            <stop offset="22%" stopColor="#a78bfa" stopOpacity="0.34" />
            <stop offset="48%" stopColor="#7c3aed" stopOpacity="0.16" />
            <stop offset="74%" stopColor="#6d28d9" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="twinFigPlatform" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#f0e9ff" stopOpacity="0.95" />
            <stop offset="22%" stopColor="#c4b5fd" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="78%" stopColor="#22d3ee" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <mask id="twinFigBodyMask">
            <image
              href="/brand/empathy-twin-body.png"
              x={BODY.x}
              y={BODY.y}
              width={BODY.w}
              height={BODY.h}
              preserveAspectRatio="xMidYMid meet"
            />
          </mask>
          <filter id="twinFigGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="twinFigSoftBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <style>{`
          @keyframes twinFigBreathe{0%,100%{opacity:.86}50%{opacity:1}}
          @keyframes twinFigTwinkle{0%,100%{opacity:.45}50%{opacity:.9}}
          .twin-fig-breathe{animation:twinFigBreathe 5.5s ease-in-out infinite}
          .twin-fig-twinkle{animation:twinFigTwinkle 4.5s ease-in-out infinite}
          @media(prefers-reduced-motion:reduce){.twin-fig-breathe,.twin-fig-twinkle{animation:none}}
        `}</style>

        <ellipse cx={CX} cy={AURA_Y} rx="150" ry="220" fill="url(#twinFigAura)" filter="url(#twinFigSoftBlur)" />
        <ellipse cx={CX} cy={FEET_Y} rx="150" ry="58" fill="url(#twinFigUplight)" filter="url(#twinFigSoftBlur)" />

        <g className="twin-fig-twinkle">
          {DOTS.map((d, i) => (
            <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.s} fill={d.c} opacity={d.o} />
          ))}
        </g>

        <ellipse cx={CX} cy={FEET_Y + 2} rx="118" ry="20" fill="url(#twinFigPlatform)" filter="url(#twinFigSoftBlur)" />

        <rect
          className="twin-fig-breathe"
          x={BODY.x}
          y={BODY.y}
          width={BODY.w}
          height={BODY.h}
          fill="url(#twinFigGrad)"
          mask="url(#twinFigBodyMask)"
          filter="url(#twinFigGlow)"
        />
        <ellipse cx={CX} cy={FEET_Y + 2} rx="40" ry="10" fill="url(#twinFigPlatform)" opacity="0.9" />
        <circle cx={CX} cy={FEET_Y} r="3.2" fill="#ffffff" filter="url(#twinFigGlow)" />
      </svg>
    </div>
  );
}
