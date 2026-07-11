import { Mountain3D } from "./Mountain3D";

type Labels = {
  routeTitle: string;
  elevation: string;
  distance: string;
  elevGain: string;
  movingTime: string;
  avgSpeed: string;
  avgHr: string;
  avgPower: string;
};

/**
 * Percorso GPS: montagna 3D reale (WebGL) con rotta a spirale + camera che orbita,
 * più i contatori tipici dell'attività. La scena 3D è self-contained (Mountain3D).
 */
export function GpsRouteMap({ labels }: { labels: Labels }) {
  const stats = [
    { label: labels.distance, value: "42.6", unit: "km", accent: "#22d3ee" },
    { label: labels.elevGain, value: "1 240", unit: "m", accent: "#34d399" },
    { label: labels.movingTime, value: "2:38", unit: "h", accent: "#f9a8d4" },
    { label: labels.avgSpeed, value: "24.1", unit: "km/h", accent: "#67e8f9" },
    { label: labels.avgHr, value: "152", unit: "bpm", accent: "#f472b6" },
    { label: labels.avgPower, value: "248", unit: "W", accent: "#c4b5fd" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-cyan-600/15 to-emerald-600/15 blur-2xl" aria-hidden />
      <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{labels.routeTitle}</span>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold text-cyan-200">3D</span>
        </div>

        {/* montagna 3D reale */}
        <Mountain3D />

        {/* contatori attività */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
              <span className="block text-[9px] uppercase tracking-wider text-gray-500">{s.label}</span>
              <span className="mt-0.5 flex items-baseline gap-0.5">
                <span className="text-base font-black tabular-nums" style={{ color: s.accent }}>{s.value}</span>
                <span className="text-[9px] text-gray-500">{s.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
