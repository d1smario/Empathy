type Labels = { loadTitle: string; weeklyLoad: string; readiness: string; planAdapts: string };

/** Carico settimanale (barre) + readiness (linea): il piano si adatta. SVG illustrativo. */
export function AdaptiveLoadChart({ labels }: { labels: Labels }) {
  const bars = [58, 72, 40, 84, 30, 96, 52]; // carico per giorno (%)
  const readiness = [70, 64, 82, 58, 88, 46, 76];
  const days = ["L", "M", "M", "G", "V", "S", "D"];
  const W = 280;
  const H = 150;
  const pad = 24;
  const bw = 20;
  const gap = (W - pad * 2 - bw * 7) / 6;
  const x = (i: number) => pad + i * (bw + gap);
  const y = (v: number) => H - 26 - (v / 100) * (H - 46);
  const readinessPts = readiness.map((v, i) => `${x(i) + bw / 2},${y(v)}`).join(" ");
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-pink-600/15 to-amber-600/15 blur-2xl" aria-hidden />
      <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{labels.loadTitle}</span>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-pink-300"><span className="h-1.5 w-2 rounded-sm bg-pink-400/70" />{labels.weeklyLoad}</span>
            <span className="flex items-center gap-1 text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{labels.readiness}</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={labels.loadTitle}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={pad} y1={y(f * 100)} x2={W - pad} y2={y(f * 100)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          {bars.map((v, i) => (
            <g key={i}>
              <rect x={x(i)} y={y(v)} width={bw} height={H - 26 - y(v)} rx="4" fill="url(#loadBar)" />
              <text x={x(i) + bw / 2} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">{days[i]}</text>
            </g>
          ))}
          <defs>
            <linearGradient id="loadBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <polyline points={readinessPts} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {readiness.map((v, i) => (
            <circle key={i} cx={x(i) + bw / 2} cy={y(v)} r="2.5" fill="#0b0b0f" stroke="#fbbf24" strokeWidth="1.5" />
          ))}
        </svg>
        <p className="mt-2 text-center text-[11px] text-gray-500">↳ {labels.planAdapts}</p>
      </div>
    </div>
  );
}
