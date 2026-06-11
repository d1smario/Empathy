"use client";

import { useState } from "react";

interface DomainsSectionProps {
  title: string;
}

const domains = [
  {
    label: "Aerodinamica",
    desc: "Analisi CdA, posizione sul sellino e simulazione vento.",
    color: "text-purple-300",
    border: "border-purple-500/20",
    bg: "from-purple-500/5 to-transparent",
    icon: (
      <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20 Q 20 10, 32 20 T 60 20" className="text-purple-400" style={{ strokeDasharray: 80, strokeDashoffset: 0, animation: "windFlow 2s linear infinite" }} />
        <path d="M4 32 Q 20 22, 32 32 T 60 32" className="text-pink-400" style={{ strokeDasharray: 80, strokeDashoffset: 0, animation: "windFlow 2.5s linear infinite", animationDelay: "0.3s" }} />
        <path d="M4 44 Q 20 34, 32 44 T 60 44" className="text-orange-400" style={{ strokeDasharray: 80, strokeDashoffset: 0, animation: "windFlow 3s linear infinite", animationDelay: "0.6s" }} />
        <circle cx="52" cy="32" r="4" fill="rgba(168,85,247,0.2)" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Fisiologia",
    desc: "Zone cardiache, soglie metaboliche e bioenergetica.",
    color: "text-pink-300",
    border: "border-pink-500/20",
    bg: "from-pink-500/5 to-transparent",
    icon: (
      <svg viewBox="0 0 64 64" className="h-12 w-12" fill="currentColor">
        <path
          d="M32 56 C32 56 8 38 8 24 C8 14 16 8 24 8 C28 8 32 12 32 12 C32 12 36 8 40 8 C48 8 56 14 56 24 C56 38 32 56 32 56Z"
          className="text-pink-500"
          style={{ transformOrigin: "center", animation: "heartPulse 1.2s ease-in-out infinite" }}
        />
      </svg>
    ),
  },
  {
    label: "Biomeccanica",
    desc: "Cadenza, ground contact, angoli articolari ed efficienza.",
    color: "text-cyan-300",
    border: "border-cyan-500/20",
    bg: "from-cyan-500/5 to-transparent",
    icon: (
      <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="32" y1="12" x2="32" y2="32" className="text-gray-300" />
        <line x1="32" y1="32" x2="48" y2="48" className="text-cyan-400" style={{ transformOrigin: "32px 32px", animation: "kneeBend 2s ease-in-out infinite alternate" }} />
        <circle cx="32" cy="32" r="5" fill="rgba(34,211,238,0.15)" stroke="rgba(34,211,238,0.6)" />
        <circle cx="32" cy="12" r="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" />
        <circle cx="48" cy="48" r="4" fill="rgba(34,211,238,0.1)" stroke="rgba(34,211,238,0.4)" />
      </svg>
    ),
  },
  {
    label: "Nutrizione",
    desc: "Ossidazione carb/fat, piani di fueling e metabolismo.",
    color: "text-green-300",
    border: "border-green-500/20",
    bg: "from-green-500/5 to-transparent",
    icon: (
      <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="32" cy="32" r="10" className="text-green-400" />
        <g style={{ transformOrigin: "32px 32px", animation: "spin 4s linear infinite" }}>
          <circle cx="32" cy="14" r="4" fill="rgba(74,222,128,0.3)" stroke="none" />
          <circle cx="46" cy="40" r="4" fill="rgba(74,222,128,0.3)" stroke="none" />
          <circle cx="18" cy="40" r="4" fill="rgba(74,222,128,0.3)" stroke="none" />
        </g>
        <line x1="32" y1="22" x2="32" y2="14" className="text-green-400/50" />
        <line x1="38" y1="36" x2="46" y2="40" className="text-green-400/50" />
        <line x1="26" y1="36" x2="18" y2="40" className="text-green-400/50" />
      </svg>
    ),
  },
  {
    label: "Training Load",
    desc: "ATL, CTL, readiness e modelli di adattamento.",
    color: "text-orange-300",
    border: "border-orange-500/20",
    bg: "from-orange-500/5 to-transparent",
    icon: (
      <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline
          points="4,48 16,36 28,40 40,24 52,28 60,12"
          className="text-orange-400"
          style={{ strokeDasharray: 120, strokeDashoffset: 120, animation: "drawLine 2.5s ease-out infinite alternate" }}
        />
        <circle cx="60" cy="12" r="3" fill="rgba(249,115,22,0.3)" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Coaching",
    desc: "Pianificazione periodizzata, feedback e obiettivi.",
    color: "text-indigo-300",
    border: "border-indigo-500/20",
    bg: "from-indigo-500/5 to-transparent",
    icon: (
      <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="32" cy="32" r="20" className="text-indigo-400/30" />
        <circle cx="32" cy="32" r="12" className="text-indigo-400/50" />
        <circle cx="32" cy="32" r="4" className="text-indigo-400" fill="rgba(129,140,248,0.2)" />
        <line x1="32" y1="32" x2="32" y2="14" className="text-indigo-400" style={{ transformOrigin: "32px 32px", animation: "radarSweep 2s linear infinite" }} />
      </svg>
    ),
  },
];

export function DomainsSection({ title }: DomainsSectionProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-24 sm:px-6 md:pt-32">
      <h2 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {domains.map((d, i) => (
          <div
            key={d.label}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`group relative overflow-hidden rounded-2xl border ${d.border} bg-gradient-to-b ${d.bg} p-6 backdrop-blur-sm transition hover:border-white/20`}
          >
            <div className={`mb-4 transition-transform duration-500 ${hovered === i ? "scale-110" : ""}`}>
              {d.icon}
            </div>
            <h3 className={`font-mono text-sm font-bold uppercase tracking-wider ${d.color}`}>{d.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{d.desc}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes windFlow {
          0% { stroke-dashoffset: 80; }
          100% { stroke-dashoffset: -80; }
        }
        @keyframes heartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes kneeBend {
          0% { transform: rotate(-15deg); }
          100% { transform: rotate(25deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
