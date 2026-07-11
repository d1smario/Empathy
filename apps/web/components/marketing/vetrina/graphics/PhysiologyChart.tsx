type Labels = { physioTitle: string; lactate: string; threshold: string; power: string };

/**
 * Soglia fisiologica: lattato vs potenza con FC sovrapposta, marker soglia.
 * Look "lab" tech: griglia fine, glow al neon, pulsazione che corre sulla curva
 * (come l'ECG) e marker soglia che pulsa. SVG + CSS, reduced-motion safe.
 */
export function PhysiologyChart({ labels }: { labels: Labels }) {
  const lactate = "20,132 60,128 100,122 140,112 180,96 210,72 236,40 258,16";
  const hr = "20,120 60,112 100,102 140,90 180,76 210,62 236,48 258,36";
  const thresholdX = 200;
  const tp = { x: 200, y: 80 }; // punto soglia sulla curva lattato
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-violet-600/15 to-pink-600/15 blur-2xl" aria-hidden />
      <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <span className="physio-live h-1.5 w-1.5 rounded-full bg-violet-400" />
            {labels.physioTitle}
          </span>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{labels.lactate}</span>
            <span className="flex items-center gap-1 text-pink-300"><span className="h-1.5 w-1.5 rounded-full bg-pink-400" />FC/HR</span>
          </div>
        </div>
        <svg viewBox="0 0 280 168" className="w-full" role="img" aria-label={labels.physioTitle}>
          <defs>
            <filter id="physioGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="lacFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* griglia fine */}
          {[16, 40, 64, 88, 112, 136].map((y) => (
            <line key={`h${y}`} x1="20" y1={y} x2="270" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}
          {[70, 120, 170, 220].map((x) => (
            <line key={`v${x}`} x1={x} y1="12" x2={x} y2="150" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}
          {/* tick asse y (mmol/L) */}
          {[["2", 136], ["4", 104], ["6", 72], ["8", 40]].map(([t, y]) => (
            <text key={t as string} x="4" y={(y as number) + 3} fill="rgba(255,255,255,0.28)" fontSize="6.5">{t}</text>
          ))}

          {/* soglia */}
          <line x1={thresholdX} y1="12" x2={thresholdX} y2="150" stroke="rgba(244,114,182,0.45)" strokeWidth="1.5" strokeDasharray="3 4" />
          <g className="physio-chip">
            <rect x={thresholdX - 22} y="3" width="44" height="14" rx="7" fill="rgba(244,114,182,0.16)" stroke="rgba(244,114,182,0.4)" strokeWidth="0.6" />
            <text x={thresholdX} y="13" textAnchor="middle" fill="#f9a8d4" fontSize="8" fontWeight="700">{labels.threshold}</text>
          </g>

          {/* HR */}
          <polyline points={hr} fill="none" stroke="#f472b6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          {/* lattato */}
          <polygon points={`${lactate} 258,150 20,150`} fill="url(#lacFill)" />
          <polyline points={lactate} fill="none" stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {/* pulsazione che corre sulla curva lattato */}
          <polyline
            points={lactate}
            fill="none"
            stroke="#c4b5fd"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#physioGlow)"
            pathLength={1000}
            className="physio-run"
            style={{ strokeDasharray: "40 1000" }}
          />

          {/* marker soglia che pulsa */}
          <circle className="physio-ping" cx={tp.x} cy={tp.y} r="4" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
          <circle cx={tp.x} cy={tp.y} r="3" fill="#0b0b0f" stroke="#f9a8d4" strokeWidth="1.8" filter="url(#physioGlow)" />

          {/* asse x */}
          <line x1="20" y1="150" x2="270" y2="150" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <text x="145" y="164" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">{labels.power} (W)</text>
        </svg>
      </div>

      <style>{`
        .physio-run { stroke-dashoffset: 1040; }
        @media (prefers-reduced-motion: no-preference) {
          .physio-run { animation: physioRun 4.4s linear infinite; }
          .physio-ping { transform-box: fill-box; transform-origin: center; animation: physioPing 2.2s ease-out infinite; }
          .physio-chip { animation: physioChip 2.2s ease-in-out infinite; }
          .physio-live { animation: physioLive 1.4s ease-in-out infinite; }
        }
        @keyframes physioRun { from { stroke-dashoffset: 1040; } to { stroke-dashoffset: 0; } }
        @keyframes physioPing { 0% { transform: scale(0.6); opacity: 0.8; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes physioChip { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes physioLive { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
