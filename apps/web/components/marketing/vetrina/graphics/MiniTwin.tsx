type Labels = { twinTitle: string; readiness: string; load: string; recovery: string };

/** Twin digitale: gauge radiali (readiness/carico/recupero) + score + sweep rotante. */
export function MiniTwin({ labels, className = "" }: { labels: Labels; className?: string }) {
  const rings = [
    { label: labels.readiness, value: 78, r: 40, color: "#fbbf24" },
    { label: labels.load, value: 62, r: 31, color: "#f472b6" },
    { label: labels.recovery, value: 71, r: 22, color: "#22d3ee" },
  ];
  return (
    <div className={`relative mx-auto w-full max-w-md ${className}`}>
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-600/15 to-violet-600/15 blur-2xl" aria-hidden />
      <div className="flex h-full flex-col justify-center rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-1.5">
          <span className="twin-live h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-xs font-semibold text-white">{labels.twinTitle}</span>
        </div>
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" role="img" aria-label={labels.twinTitle}>
            <defs>
              <filter id="twinGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.6" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {rings.map((ring) => {
              const c = 2 * Math.PI * ring.r;
              const filled = (ring.value / 100) * c;
              return (
                <g key={ring.label}>
                  <circle cx="50" cy="50" r={ring.r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                  <circle
                    cx="50"
                    cy="50"
                    r={ring.r}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${filled.toFixed(1)} ${c.toFixed(1)}`}
                    transform="rotate(-90 50 50)"
                    filter="url(#twinGlow)"
                  />
                </g>
              );
            })}
            {/* sweep radar */}
            <line className="twin-sweep" x1="50" y1="50" x2="50" y2="8" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <text x="50" y="49" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="800">82</text>
            <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="6.5">score</text>
          </svg>
          <div className="flex-1 space-y-2.5">
            {rings.map((ring) => (
              <div key={ring.label} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ring.color }} />
                  {ring.label}
                </span>
                <span className="font-mono tabular-nums" style={{ color: ring.color }}>{ring.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .twin-sweep { transform-box: fill-box; transform-origin: 50% 100%; animation: twinSweep 6s linear infinite; }
          .twin-live { animation: twinLive 1.4s ease-in-out infinite; }
        }
        @keyframes twinSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes twinLive { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
