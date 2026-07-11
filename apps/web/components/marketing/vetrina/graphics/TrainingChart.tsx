type Labels = { trainingTitle: string; power: string; hr: string };

/**
 * Traccia HD potenza & FC di una seduta a intervalli (SVG deterministico, denso e
 * rumoroso come un dato reale). Stile "dettaglio seduta".
 */
export function TrainingChart({ labels, className = "" }: { labels: Labels; className?: string }) {
  const N = 76;
  const W = 280;
  const top = 8;
  const bottom = 96;
  const padL = 6;
  const padR = 4;

  const power: number[] = [];
  const hr: number[] = [];
  let hrv = 128;
  for (let i = 0; i < N; i++) {
    const work = i % 20 < 11 ? 1 : 0; // blocchi lavoro/recupero
    const base = 172 + work * 120;
    const noise = 17 * Math.sin(i * 1.93) + 9 * Math.sin(i * 0.71) + 6 * Math.sin(i * 3.4);
    const p = Math.max(95, Math.min(388, base + noise));
    power.push(p);
    const target = 116 + ((p - 172) / 210) * 72;
    hrv += (target - hrv) * 0.17 + 1.6 * Math.sin(i * 0.9);
    hr.push(Math.max(110, Math.min(191, hrv)));
  }

  const x = (i: number) => padL + (i / (N - 1)) * (W - padL - padR);
  const yP = (v: number) => top + (1 - (v - 90) / (390 - 90)) * (bottom - top);
  const yH = (v: number) => top + (1 - (v - 105) / (196 - 105)) * (bottom - top);
  const ptsP = power.map((v, i) => `${x(i).toFixed(1)},${yP(v).toFixed(1)}`).join(" ");
  const ptsH = hr.map((v, i) => `${x(i).toFixed(1)},${yH(v).toFixed(1)}`).join(" ");

  return (
    <div className={`rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-white">{labels.trainingTitle}</span>
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{labels.power}</span>
          <span className="flex items-center gap-1 text-pink-300"><span className="h-1.5 w-1.5 rounded-full bg-pink-400" />{labels.hr}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} 108`} className="w-full" role="img" aria-label={labels.trainingTitle}>
        {/* fasce zone FC */}
        {[
          { y: top, h: 18, c: "rgba(248,113,113,0.06)" },
          { y: top + 18, h: 22, c: "rgba(251,191,36,0.05)" },
          { y: top + 40, h: 30, c: "rgba(52,211,153,0.04)" },
        ].map((b, i) => (
          <rect key={i} x={padL} y={b.y} width={W - padL - padR} height={b.h} fill={b.c} />
        ))}
        {[24, 48, 72].map((y) => (
          <line key={y} x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {/* potenza (area + linea) */}
        <polygon points={`${ptsP} ${x(N - 1).toFixed(1)},${bottom} ${x(0).toFixed(1)},${bottom}`} fill="#a78bfa" opacity="0.10" />
        <polyline points={ptsP} fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {/* FC */}
        <polyline points={ptsH} fill="none" stroke="#f472b6" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
        {/* asse y (W) */}
        {[100, 200, 300].map((w) => (
          <text key={w} x={padL} y={yP(w) - 2} fill="rgba(255,255,255,0.28)" fontSize="6.5">{w}W</text>
        ))}
      </svg>
    </div>
  );
}
