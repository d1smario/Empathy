type Labels = {
  routeTitle: string;
  elevation: string;
  distance: string;
  elevGain: string;
  movingTime: string;
  avgSpeed: string;
  avgHr: string;
  avgPower: string;
};

/**
 * Percorso GPS in mini-mappa 3D (prospettiva) con elevazione estrusa + punto che
 * scorre + contatori tipici dell'attività. SVG deterministico, illustrativo.
 */
export function GpsRouteMap({ labels }: { labels: Labels }) {
  // angoli del piano in prospettiva (far = alto/stretto, near = basso/largo)
  const FL = [96, 44];
  const FR = [204, 44];
  const NL = [6, 158];
  const NR = [294, 158];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const proj = (u: number, v: number): [number, number] => {
    const topX = lerp(FL[0], FR[0], u);
    const botX = lerp(NL[0], NR[0], u);
    return [lerp(topX, botX, v), lerp(FL[1], NL[1], v)];
  };

  const N = 44;
  const pts: { x: number; y: number; gy: number }[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const u = 0.5 + 0.4 * Math.sin(t * Math.PI * 3) + 0.06 * Math.sin(t * Math.PI * 7);
    const v = 0.9 - 0.74 * t + 0.06 * Math.sin(t * Math.PI * 4);
    const e = 24 * Math.sin(t * Math.PI) + 7 * Math.sin(t * Math.PI * 5) + 5; // elevazione
    const [px, py] = proj(Math.max(0.04, Math.min(0.96, u)), Math.max(0.05, Math.min(0.95, v)));
    const depth = 0.55 + (1 - v) * 0.45; // più lontano = elevazione un filo compressa
    pts.push({ x: px, y: py - e * depth, gy: py });
  }
  const topPoly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const wall =
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    " " +
    [...pts].reverse().map((p) => `${p.x.toFixed(1)},${p.gy.toFixed(1)}`).join(" ");
  const routeD = "M" + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L");
  const start = pts[0]!;
  const end = pts[N - 1]!;

  const stats = [
    { label: labels.distance, value: "42.6", unit: "km", accent: "#22d3ee" },
    { label: labels.elevGain, value: "640", unit: "m", accent: "#34d399" },
    { label: labels.movingTime, value: "1:24", unit: "h", accent: "#f9a8d4" },
    { label: labels.avgSpeed, value: "30.4", unit: "km/h", accent: "#67e8f9" },
    { label: labels.avgHr, value: "148", unit: "bpm", accent: "#f472b6" },
    { label: labels.avgPower, value: "232", unit: "W", accent: "#c4b5fd" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-cyan-600/15 to-emerald-600/15 blur-2xl" aria-hidden />
      <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{labels.routeTitle}</span>
          <span className="text-[10px] text-gray-500">3D</span>
        </div>

        {/* mappa 3D */}
        <svg viewBox="0 0 300 172" className="w-full overflow-visible" role="img" aria-label={labels.routeTitle}>
          <defs>
            <linearGradient id="ground3d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0e1a1a" />
              <stop offset="100%" stopColor="#0b0f14" />
            </linearGradient>
            <linearGradient id="wall3d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* piano terreno */}
          <polygon points={`${FL[0]},${FL[1]} ${FR[0]},${FR[1]} ${NR[0]},${NR[1]} ${NL[0]},${NL[1]}`} fill="url(#ground3d)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          {/* griglia in profondità */}
          {[1, 2, 3, 4, 5].map((k) => {
            const v = k / 6;
            const a = proj(0, v);
            const b = proj(1, v);
            return <line key={`d${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
          })}
          {/* corsie */}
          {[1, 2, 3, 4, 5].map((k) => {
            const u = k / 6;
            const a = proj(u, 0);
            const b = proj(u, 1);
            return <line key={`l${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
          })}

          {/* estrusione (parete elevazione) */}
          <polygon points={wall} fill="url(#wall3d)" />
          {/* ombra a terra */}
          <polyline points={pts.map((p) => `${p.x.toFixed(1)},${p.gy.toFixed(1)}`).join(" ")} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" opacity="0.4" />
          {/* rotta */}
          <polyline points={topPoly} fill="none" stroke="#67e8f9" strokeWidth="1.5" opacity="0.25" />
          <polyline points={topPoly} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* punto che scorre */}
          <circle r="3.5" fill="#fff">
            <animateMotion dur="7s" repeatCount="indefinite" path={routeD} />
          </circle>

          {/* start / end */}
          <circle cx={start.x} cy={start.y} r="4" fill="#0b0b0f" stroke="#22d3ee" strokeWidth="2" />
          <circle cx={end.x} cy={end.y} r="4" fill="#34d399" stroke="#0b0b0f" strokeWidth="2" />
        </svg>

        {/* contatori attività */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
              <span className="block text-[9px] uppercase tracking-wider text-gray-500">{s.label}</span>
              <span className="mt-0.5 flex items-baseline gap-0.5">
                <span className="text-base font-black tabular-nums" style={{ color: s.accent }}>{s.value}</span>
                <span className="text-[9px] text-gray-500">{s.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
