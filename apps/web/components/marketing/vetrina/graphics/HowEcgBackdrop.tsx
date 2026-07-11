/**
 * Fondale animato stile elettrocardiogramma dietro il titolo di "Come funziona".
 * Traccia ECG statica (fioca) + una "pulsazione" luminosa che corre da sinistra a
 * destra in loop continuo (stroke-dash). Solo SVG+CSS, nessun JS, reduced-motion safe.
 */

/** Punti di una traccia ECG ripetuta lungo la larghezza (baseline + complessi PQRST). */
function ecgPoints(width: number, baseline: number, beat: number, amp: number): string {
  const tmpl: [number, number][] = [
    [0, 0], [beat * 0.22, 0],
    [beat * 0.27, -amp * 0.14], [beat * 0.32, 0], // P
    [beat * 0.42, 0],
    [beat * 0.45, amp * 0.12], [beat * 0.49, -amp], [beat * 0.53, amp * 0.4], [beat * 0.57, 0], // QRS
    [beat * 0.7, 0],
    [beat * 0.76, -amp * 0.34], [beat * 0.86, 0], // T
    [beat, 0],
  ];
  const pts: string[] = [];
  for (let x = 0; x < width + beat; x += beat) {
    for (const [dx, dy] of tmpl) pts.push(`${(x + dx).toFixed(1)},${(baseline + dy).toFixed(1)}`);
  }
  return pts.join(" ");
}

const LINES = [
  { baseline: 58, beat: 128, amp: 40, color: "#22d3ee", dur: "3.6s", delay: "0s" },
  { baseline: 104, beat: 158, amp: 34, color: "#f472b6", dur: "5.2s", delay: "-1.4s" },
  { baseline: 150, beat: 108, amp: 30, color: "#a78bfa", dur: "4.4s", delay: "-2.6s" },
];

export function HowEcgBackdrop() {
  const W = 1200;
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]" aria-hidden>
      <svg viewBox={`0 0 ${W} 200`} preserveAspectRatio="none" className="h-full w-full opacity-[0.5]">
        {LINES.map((l, i) => {
          const pts = ecgPoints(W, l.baseline, l.beat, l.amp);
          return (
            <g key={i}>
              {/* traccia statica fioca */}
              <polyline points={pts} fill="none" stroke={l.color} strokeWidth="1" opacity="0.14" strokeLinejoin="round" strokeLinecap="round" />
              {/* pulsazione che corre L→R */}
              <polyline
                points={pts}
                fill="none"
                stroke={l.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1000}
                className="how-ecg-run"
                style={{ strokeDasharray: "44 1000", animationDuration: l.dur, animationDelay: l.delay }}
              />
            </g>
          );
        })}
      </svg>
      <style>{`
        .how-ecg-run { stroke-dashoffset: 1044; }
        @media (prefers-reduced-motion: no-preference) {
          .how-ecg-run { animation-name: howEcgRun; animation-timing-function: linear; animation-iteration-count: infinite; }
        }
        @keyframes howEcgRun { from { stroke-dashoffset: 1044; } to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
