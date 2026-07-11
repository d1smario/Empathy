type Labels = { loadTitle: string; weeklyLoad: string; readiness: string; planAdapts: string; weeksAgo: string; today: string };

/**
 * Carico giornaliero (28 giorni) + trend fitness + readiness. Look tech/alive in linea
 * con gli altri: griglia, glow, pulsazione che corre sulla readiness e marker "oggi" che
 * pulsa. SVG + CSS, reduced-motion safe.
 */
export function AdaptiveLoadChart({ labels }: { labels: Labels }) {
  const days = 28;
  const W = 280;
  const H = 156;
  const padL = 8;
  const padR = 8;
  const baseY = H - 22;
  const topY = 10;

  const load: number[] = [];
  const ctl: number[] = [];
  const readiness: number[] = [];
  let c = 42;
  let a = 46;
  for (let i = 0; i < days; i++) {
    const dow = i % 7;
    const rest = dow === 0 || (dow === 4 && i % 14 > 8);
    let l = rest ? 8 + 6 * Math.abs(Math.sin(i * 1.3)) : 54 + 28 * Math.sin(i * 0.9) + 20 * Math.sin(i * 0.4);
    if (dow === 6) l += 34;
    l = Math.max(4, Math.min(122, l + 8 * Math.sin(i * 2.7)));
    load.push(l);
    c += (l - c) * 0.12;
    a += (l - a) * 0.33;
    ctl.push(c);
    readiness.push(Math.max(32, Math.min(94, 60 + (c - a) + 5 * Math.sin(i * 0.5))));
  }

  const bw = (W - padL - padR) / days;
  const x = (i: number) => padL + i * bw + bw / 2;
  const yLoad = (v: number) => baseY - (v / 122) * (baseY - topY);
  const yRead = (v: number) => baseY - (v / 100) * (baseY - topY);
  const ctlPts = ctl.map((v, i) => `${x(i).toFixed(1)},${yLoad(v).toFixed(1)}`).join(" ");
  const readPts = readiness.map((v, i) => `${x(i).toFixed(1)},${yRead(v).toFixed(1)}`).join(" ");
  const last = days - 1;
  const todayX = x(last);
  const todayY = yRead(readiness[last]!);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-pink-600/15 to-amber-600/15 blur-2xl" aria-hidden />
      <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <span className="load-live h-1.5 w-1.5 rounded-full bg-amber-400" />
            {labels.loadTitle}
          </span>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-pink-300"><span className="h-1.5 w-2 rounded-sm bg-pink-400/70" />{labels.weeklyLoad}</span>
            <span className="flex items-center gap-1 text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{labels.readiness}</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={labels.loadTitle}>
          <defs>
            <filter id="loadGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="loadBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={padL} y1={topY + (baseY - topY) * (1 - f)} x2={W - padR} y2={topY + (baseY - topY) * (1 - f)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          {/* barre carico */}
          {load.map((v, i) => (
            <rect key={i} x={padL + i * bw + bw * 0.18} y={yLoad(v)} width={bw * 0.64} height={baseY - yLoad(v)} rx="1.2" fill="url(#loadBar)" opacity={i === last ? 1 : 0.9} />
          ))}
          {/* trend fitness */}
          <polyline points={ctlPts} fill="none" stroke="#f9a8d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
          {/* readiness */}
          <polyline points={readPts} fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          {/* pulsazione che corre sulla readiness */}
          <polyline
            points={readPts}
            fill="none"
            stroke="#fde68a"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#loadGlow)"
            pathLength={1000}
            className="load-run"
            style={{ strokeDasharray: "40 1000" }}
          />
          {/* marcatori settimana */}
          {[7, 14, 21].map((d) => (
            <line key={d} x1={padL + d * bw} y1={topY} x2={padL + d * bw} y2={baseY} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 4" />
          ))}
          {/* marker "oggi" che pulsa */}
          <circle className="load-ping" cx={todayX} cy={todayY} r="4" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
          <circle cx={todayX} cy={todayY} r="3" fill="#0b0b0f" stroke="#fbbf24" strokeWidth="1.8" filter="url(#loadGlow)" />

          <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          {[labels.weeksAgo, labels.today].map((lab, i) => (
            <text key={lab} x={i === 0 ? padL : W - padR} y={H - 6} textAnchor={i === 0 ? "start" : "end"} fill="rgba(255,255,255,0.3)" fontSize="7">{lab}</text>
          ))}
        </svg>
        <p className="mt-2 text-center text-[11px] text-gray-500">↳ {labels.planAdapts}</p>
      </div>

      <style>{`
        .load-run { stroke-dashoffset: 1040; }
        @media (prefers-reduced-motion: no-preference) {
          .load-run { animation: loadRun 4.8s linear infinite; }
          .load-ping { transform-box: fill-box; transform-origin: center; animation: loadPing 2.2s ease-out infinite; }
          .load-live { animation: loadLive 1.4s ease-in-out infinite; }
        }
        @keyframes loadRun { from { stroke-dashoffset: 1040; } to { stroke-dashoffset: 0; } }
        @keyframes loadPing { 0% { transform: scale(0.6); opacity: 0.8; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes loadLive { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
