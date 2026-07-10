/**
 * AppMockup — mockup stilizzato dell'app (SVG, nessun dato reale).
 * Dashboard illustrativa: gauge readiness, area chart carico, stat tiles.
 * Variante `variant` per mostrare accenti diversi lungo la pagina.
 */
export function AppMockup({ variant = "training" }: { variant?: "training" | "nutrition" | "physiology" }) {
  const accent = variant === "nutrition" ? "#67e8f9" : variant === "physiology" ? "#c4b5fd" : "#f472b6";
  const area = variant === "nutrition" ? "34,70 60,60 86,64 112,48 138,52 164,38 190,44 216,30" : "34,74 60,52 86,58 112,40 138,60 164,34 190,46 216,26";
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-purple-600/20 to-pink-600/20 blur-2xl" aria-hidden />
      <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b0b0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Empathy</span>
        </div>
        <svg viewBox="0 0 250 210" className="w-full" role="img" aria-hidden>
          {/* gauge readiness */}
          <g transform="translate(20,18)">
            <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
              cx="34"
              cy="34"
              r="28"
              fill="none"
              stroke={accent}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="176"
              strokeDashoffset="52"
              transform="rotate(-90 34 34)"
            />
            <text x="34" y="32" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">
              82
            </text>
            <text x="34" y="46" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="7">
              readiness
            </text>
          </g>
          {/* stat tiles */}
          <g transform="translate(96,20)">
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(0,${i * 22})`}>
                <rect x="0" y="0" width="134" height="17" rx="4" fill="rgba(255,255,255,0.04)" />
                <rect x="6" y="6" width="46" height="5" rx="2.5" fill="rgba(255,255,255,0.18)" />
                <rect x="104" y="5" width="24" height="7" rx="3.5" fill={accent} opacity="0.55" />
              </g>
            ))}
          </g>
          {/* area chart */}
          <g transform="translate(0,96)">
            <rect x="16" y="4" width="218" height="96" rx="10" fill="rgba(255,255,255,0.03)" />
            <polyline points={area} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,8)" />
            <polygon points={`${area} 216,96 34,96`} fill={accent} opacity="0.12" transform="translate(0,8)" />
            {[34, 86, 138, 190].map((x) => (
              <line key={x} x1={x} y1="12" x2={x} y2="96" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
