type Labels = { physioTitle: string; lactate: string; threshold: string; power: string };

/**
 * Curva fisiologica: lattato (mmol/L) vs potenza (W) con FC sovrapposta e marker soglia.
 * SVG statico ad alta fedeltà (illustrativo, non dati reali).
 */
export function PhysiologyChart({ labels }: { labels: Labels }) {
  // punti lattato (curva a J) su griglia 300x150
  const lactate = "20,132 60,128 100,122 140,112 180,96 210,72 236,40 258,16";
  const hr = "20,120 60,112 100,102 140,90 180,76 210,62 236,48 258,36";
  const thresholdX = 200;
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-violet-600/15 to-pink-600/15 blur-2xl" aria-hidden />
      <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{labels.physioTitle}</span>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{labels.lactate}</span>
            <span className="flex items-center gap-1 text-pink-300"><span className="h-1.5 w-1.5 rounded-full bg-pink-400" />FC/HR</span>
          </div>
        </div>
        <svg viewBox="0 0 280 168" className="w-full" role="img" aria-label={labels.physioTitle}>
          {/* griglia */}
          {[16, 48, 80, 112, 144].map((y) => (
            <line key={y} x1="20" y1={y} x2="270" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          {/* soglia */}
          <line x1={thresholdX} y1="12" x2={thresholdX} y2="150" stroke="rgba(244,114,182,0.5)" strokeWidth="1.5" strokeDasharray="3 4" />
          <rect x={thresholdX - 22} y="4" width="44" height="14" rx="7" fill="rgba(244,114,182,0.15)" />
          <text x={thresholdX} y="14" textAnchor="middle" fill="#f9a8d4" fontSize="8" fontWeight="700">{labels.threshold}</text>
          {/* HR */}
          <polyline points={hr} fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
          {/* lattato */}
          <polygon points={`${lactate} 258,150 20,150`} fill="#a78bfa" opacity="0.1" />
          <polyline points={lactate} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {[[236, 40], [210, 72], [258, 16]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#0b0b0f" stroke="#a78bfa" strokeWidth="1.8" />
          ))}
          {/* asse x */}
          <line x1="20" y1="150" x2="270" y2="150" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <text x="145" y="164" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">{labels.power} (W)</text>
        </svg>
      </div>
    </div>
  );
}
