"use client";

import Link from "next/link";

interface PreviewSectionProps {
  title: string;
  body: string;
  cta: string;
}

export function PreviewSection({ title, body, cta }: PreviewSectionProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-24 sm:px-6 md:pt-32">
      <div className="flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-gradient-to-b from-purple-500/5 via-black/20 to-orange-500/5 p-8 backdrop-blur-sm sm:p-12 lg:flex-row lg:gap-12">
        {/* Mock dashboard preview */}
        <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-black/40 p-4 shadow-2xl lg:max-w-lg">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500/60" />
            <div className="h-2 w-2 rounded-full bg-yellow-500/60" />
            <div className="h-2 w-2 rounded-full bg-green-500/60" />
            <span className="ml-2 font-mono text-[0.6rem] text-gray-500">empathy.pro/preview</span>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="h-20 flex-1 rounded-lg bg-white/5" />
              <div className="h-20 flex-1 rounded-lg bg-white/5" />
            </div>
            <div className="h-32 rounded-lg bg-white/5">
              {/* Fake chart line */}
              <svg className="h-full w-full" preserveAspectRatio="none">
                <polyline
                  points="0,80 40,60 80,70 120,40 160,50 200,20 240,35 280,15 320,25 360,10"
                  fill="none"
                  stroke="url(#previewGrad)"
                  strokeWidth="2"
                />
                <defs>
                  <linearGradient id="previewGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="50%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex gap-3">
              <div className="h-16 flex-1 rounded-lg bg-white/5" />
              <div className="h-16 flex-1 rounded-lg bg-white/5" />
              <div className="h-16 flex-1 rounded-lg bg-white/5" />
            </div>
          </div>
        </div>

        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-gray-400 lg:mx-0">{body}</p>
          <div className="mt-8">
            <Link
              href="/preview"
              className="empathy-btn-gradient inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-purple-500/50"
            >
              {cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
