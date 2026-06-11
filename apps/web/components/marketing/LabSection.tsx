"use client";

interface LabSectionProps {
  title: string;
  body: string;
}

export function LabSection({ title, body }: LabSectionProps) {
  return (
    <section id="piattaforma" className="relative mx-auto max-w-7xl px-4 pt-24 sm:px-6 md:pt-32">
      <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
        {/* Visual: watch → data flow */}
        <div className="relative flex h-64 w-full max-w-md items-center justify-center rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md lg:h-80 lg:max-w-lg">
          {/* Watch silhouette */}
          <div className="relative flex h-32 w-24 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-b from-gray-800 to-black shadow-xl">
            <div className="h-20 w-16 rounded-lg bg-black">
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <span className="font-mono text-xs text-purple-400">142</span>
                <span className="h-px w-8 bg-white/20" />
                <span className="font-mono text-[0.6rem] text-pink-400">HR</span>
              </div>
            </div>
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-purple-500/20" />
          </div>

          {/* Data flow lines */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"
                style={{
                  top: `${30 + i * 12}%`,
                  left: "30%",
                  width: "40%",
                  animation: `dataFlow ${2 + i * 0.4}s linear infinite`,
                  animationDelay: `${i * 0.3}s`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>

          {/* Cloud / server icon */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 lg:right-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <svg className="h-7 w-7 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-gray-400 lg:mx-0">
            {body}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
            {["Garmin", "Polar", "Wahoo", "FIT/TCX"].map((brand) => (
              <span
                key={brand}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono text-gray-400"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes dataFlow {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.8;
          }
          100% {
            transform: translateX(200%);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}
