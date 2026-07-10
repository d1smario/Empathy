"use client";

/**
 * Omino "digital twin" SOLO figura: corpo X-ray (public/brand/empathy-twin-body.png)
 * ricolorato col gradiente brand via maschera di luminanza, respiro, luce dal basso
 * e piattaforma luminosa — SENZA anelli HUD, tacche, connettori e badge-contatori
 * (quelli restano in DashboardTwinRadial, vista «Analisi»).
 *
 * Sfondo NEUTRO (nero soft, come le altre card) con micro-dettagli "tech" animati
 * perché non risulti statico: sensori che pingano sul corpo (anello che si espande
 * e sfuma, delay sfalsati), una scanline sottile che scorre lenta e stelline soft.
 * Tutto deterministico, niente Math.random; reduced-motion → animazioni spente.
 *
 * ID SVG prefissati `twinFig` per non collidere con DashboardTwinRadial.
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

// "Sensori" sul corpo: nodi che pingano in sequenza (delay sfalsati, colori brand).
const SENSORS = [
  { x: 170, y: 88, c: "#22d3ee", delay: 0 }, // fronte
  { x: 152, y: 185, c: "#ec4899", delay: 0.7 }, // cuore
  { x: 170, y: 252, c: "#f59e0b", delay: 1.4 }, // core
  { x: 243, y: 288, c: "#a78bfa", delay: 2.1 }, // polso dx
  { x: 148, y: 378, c: "#5eead4", delay: 2.8 }, // ginocchio sx
  { x: 190, y: 460, c: "#60a5fa", delay: 3.5 }, // caviglia dx
];

export function TwinFigureArt({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 ${className ?? ""}`}
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
          <linearGradient id="twinFigScan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
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
          @keyframes twinFigScanMove{0%{transform:translateY(-36px)}100%{transform:translateY(${VB_H + 8}px)}}
          @keyframes twinFigPing{0%{transform:scale(1);opacity:.85}70%{transform:scale(3.4);opacity:0}100%{transform:scale(3.4);opacity:0}}
          .twin-fig-breathe{animation:twinFigBreathe 5.5s ease-in-out infinite}
          .twin-fig-twinkle{animation:twinFigTwinkle 4.5s ease-in-out infinite}
          .twin-fig-scan{animation:twinFigScanMove 11s linear infinite}
          .twin-fig-ping{transform-box:fill-box;transform-origin:center;animation:twinFigPing 4.2s ease-out infinite}
          @media(prefers-reduced-motion:reduce){.twin-fig-breathe,.twin-fig-twinkle,.twin-fig-scan,.twin-fig-ping{animation:none}}
        `}</style>

        {/* Luce dal basso (l'unica "atmosfera": lo sfondo resta neutro). */}
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

        {/* Scanline tech che percorre la figura, molto tenue. */}
        <g className="twin-fig-scan">
          <rect x={CX - 132} y={0} width={264} height={30} fill="url(#twinFigScan)" />
        </g>

        {/* Sensori: nodo fisso + anello che pinga in sequenza. */}
        {SENSORS.map((s, i) => (
          <g key={`s-${i}`}>
            <circle cx={s.x} cy={s.y} r="2.1" fill={s.c} opacity="0.95" filter="url(#twinFigGlow)" />
            <circle
              className="twin-fig-ping"
              cx={s.x}
              cy={s.y}
              r="2.1"
              fill="none"
              stroke={s.c}
              strokeWidth="0.9"
              style={{ animationDelay: `${s.delay}s` }}
            />
          </g>
        ))}

        <ellipse cx={CX} cy={FEET_Y + 2} rx="40" ry="10" fill="url(#twinFigPlatform)" opacity="0.9" />
        <circle cx={CX} cy={FEET_Y} r="3.2" fill="#ffffff" filter="url(#twinFigGlow)" />
      </svg>
    </div>
  );
}
