"use client";

/**
 * Curva FC della giornata (stile app Salute): asse 24h con tick 00/06/12/18/24,
 * linea + area sfumata dai campioni REALI Garmin `timeOffsetHeartRateSamples`
 * (t = secondi dall'inizio giornata). Min/max reali a lato. Nessun dato → non
 * renderizzare (il chiamante gates su points.length).
 *
 * Nota dati: distanza/passi intraday NON arrivano dai dailies (solo totali);
 * quando l'ingest abiliterà gli epochs, questo stesso layout potrà ospitare
 * la curva km percorsi.
 */

const W = 600;
const H = 130;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 22;
const DAY_SEC = 86_400;

export function DayHeartRateCurve({
  points,
  title,
  className,
}: {
  points: Array<{ t: number; bpm: number }>;
  title: string;
  className?: string;
}) {
  if (points.length < 2) return null;

  const bpms = points.map((p) => p.bpm);
  const minBpm = Math.min(...bpms);
  const maxBpm = Math.max(...bpms);
  const span = Math.max(10, maxBpm - minBpm);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const x = (t: number) => PAD_L + (Math.min(DAY_SEC, Math.max(0, t)) / DAY_SEC) * plotW;
  const y = (bpm: number) => PAD_T + (1 - (bpm - minBpm) / span) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.bpm).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points[points.length - 1]!.t).toFixed(1)},${PAD_T + plotH} L${x(points[0]!.t).toFixed(1)},${PAD_T + plotH} Z`;

  const ticks = [0, 6, 12, 18, 24];
  const last = points[points.length - 1]!;

  return (
    <div className={`rounded-2xl border border-white/10 bg-black/40 p-3 ${className ?? ""}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-300">{title}</p>
        <p className="font-mono text-xs tabular-nums text-gray-400">
          <span className="text-gray-200">{minBpm}</span>–<span className="text-gray-200">{maxBpm}</span> bpm
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label={title}>
        <defs>
          <linearGradient id="dayHrArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Griglia oraria */}
        {ticks.map((h) => {
          const tx = PAD_L + (h / 24) * plotW;
          return (
            <g key={h}>
              <line x1={tx} y1={PAD_T} x2={tx} y2={PAD_T + plotH} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
              <text
                x={tx}
                y={H - 8}
                fill="rgba(148,163,184,0.7)"
                fontSize="10"
                fontFamily="monospace"
                textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}
              >
                {String(h).padStart(2, "0")}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#dayHrArea)" />
        <path d={line} fill="none" stroke="#fb7185" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last.t)} cy={y(last.bpm)} r="2.6" fill="#fb7185" />
      </svg>
    </div>
  );
}
