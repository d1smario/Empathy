"use client";

interface HowItWorksSectionProps {
  title: string;
  steps: { title: string; body: string }[];
}

export function HowItWorksSection({ title, steps }: HowItWorksSectionProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-24 sm:px-6 md:pt-32">
      <h2 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={i} className="relative rounded-2xl border border-white/10 bg-black/25 p-6 text-center backdrop-blur-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 font-mono text-lg font-bold text-white">
              {i + 1}
            </div>
            <h3 className="text-base font-bold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
