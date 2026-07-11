/**
 * Fondale animato per la hero della home: tre linee di STILE DIVERSO (per variare)
 * — ECG (battito), linea di grafico che sale (trend), linea a gradini (dati) —
 * ciascuna con una "pulsazione" luminosa che corre da sinistra a destra in loop.
 * Solo SVG + CSS, nessun JS, reduced-motion safe.
 */

const W = 1200;

/** ECG: baseline con complessi PQRST ripetuti. */
function ecgPoints(baseline: number, beat: number, amp: number): string {
  const tmpl: [number, number][] = [
    [0, 0], [beat * 0.22, 0],
    [beat * 0.27, -amp * 0.14], [beat * 0.32, 0],
    [beat * 0.42, 0],
    [beat * 0.45, amp * 0.12], [beat * 0.49, -amp], [beat * 0.53, amp * 0.4], [beat * 0.57, 0],
    [beat * 0.7, 0],
    [beat * 0.76, -amp * 0.34], [beat * 0.86, 0],
    [beat, 0],
  ];
  const pts: string[] = [];
  for (let x = 0; x < W + beat; x += beat) {
    for (const [dx, dy] of tmpl) pts.push(`${(x + dx).toFixed(1)},${(baseline + dy).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Trend: linea che sale (verso l'alto) con ondulazione organica. */
function trendPoints(yStart: number, rise: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 12) {
    const t = x / W;
    const y = yStart - rise * t + 9 * Math.sin(x * 0.028) + 5 * Math.sin(x * 0.075) + 3 * Math.sin(x * 0.15);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Gradini: linea a scalini (segnale dati) che oscilla per livelli. */
function stepPoints(baseline: number, seg: number, amp: number): string {
  const pts: string[] = [];
  let x = 0;
  let k = 0;
  while (x < W + seg) {
    const level = baseline + amp * Math.sin(k * 0.9) + amp * 0.4 * Math.sin(k * 2.3);
    pts.push(`${x.toFixed(1)},${level.toFixed(1)}`);
    pts.push(`${(x + seg).toFixed(1)},${level.toFixed(1)}`);
    x += seg;
    k += 1;
  }
  return pts.join(" ");
}

const LINES = [
  { points: ecgPoints(52, 128, 40), color: "#22d3ee", dur: "3.6s", delay: "0s" }, // ECG
  { points: trendPoints(150, 96), color: "#f472b6", dur: "5.4s", delay: "-1.6s" }, // trend che sale
  { points: stepPoints(112, 46, 16), color: "#a78bfa", dur: "4.6s", delay: "-2.8s" }, // gradini dati
];

export function HomeLinesBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      aria-hidden
    >
      <svg viewBox={`0 0 ${W} 200`} preserveAspectRatio="none" className="h-full w-full opacity-[0.5]">
        {LINES.map((l, i) => (
          <g key={i}>
            <polyline points={l.points} fill="none" stroke={l.color} strokeWidth="1" opacity="0.13" strokeLinejoin="round" strokeLinecap="round" />
            <polyline
              points={l.points}
              fill="none"
              stroke={l.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1000}
              className="home-line-run"
              style={{ strokeDasharray: "46 1000", animationDuration: l.dur, animationDelay: l.delay }}
            />
          </g>
        ))}
      </svg>
      <style>{`
        .home-line-run { stroke-dashoffset: 1046; }
        @media (prefers-reduced-motion: no-preference) {
          .home-line-run { animation-name: homeLineRun; animation-timing-function: linear; animation-iteration-count: infinite; }
        }
        @keyframes homeLineRun { from { stroke-dashoffset: 1046; } to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
