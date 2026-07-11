type Labels = { routeTitle: string; elevation: string; distance: string };

/** Mappa GPS del percorso + profilo altimetrico (SVG illustrativo). */
export function GpsRouteMap({ labels }: { labels: Labels }) {
  const route =
    "M24,120 C50,60 80,70 96,96 S150,150 176,110 S220,40 250,64";
  const elev = "16,52 44,44 72,48 100,30 128,40 156,22 184,34 212,16 240,28 264,20";
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-cyan-600/15 to-emerald-600/15 blur-2xl" aria-hidden />
      <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{labels.routeTitle}</span>
          <span className="text-[10px] text-gray-500">{labels.distance} · 42.6 km</span>
        </div>
        {/* mappa */}
        <svg viewBox="0 0 274 150" className="w-full rounded-xl" role="img" aria-label={labels.routeTitle}>
          <rect x="0" y="0" width="274" height="150" rx="12" fill="rgba(255,255,255,0.02)" />
          {[0, 1, 2, 3].map((i) => (
            <line key={`h${i}`} x1="0" y1={30 + i * 30} x2="274" y2={30 + i * 30} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`v${i}`} x1={45 + i * 45} y1="0" x2={45 + i * 45} y2="150" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}
          <path d={route} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
          <path d={route} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 6" />
          <circle cx="24" cy="120" r="5" fill="#0b0b0f" stroke="#22d3ee" strokeWidth="2" />
          <circle cx="250" cy="64" r="5" fill="#34d399" stroke="#0b0b0f" strokeWidth="2" />
        </svg>
        {/* altimetria */}
        <div className="mt-3">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">{labels.elevation}</span>
          <svg viewBox="0 0 280 64" className="mt-1 w-full" role="img" aria-label={labels.elevation}>
            <polygon points={`${elev} 264,64 16,64`} fill="#34d399" opacity="0.12" />
            <polyline points={elev} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
