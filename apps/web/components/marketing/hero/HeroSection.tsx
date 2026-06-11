import Link from "next/link";

// ── EDIT COPY HERE ──────────────────────────────────────────────────────────
const HERO = {
  eyebrow: "ATHLETE OS",
  title: "EMPATHY",
  subtitle:
    "Empathy e' una piattaforma di performance e physiology adaptation, capace di guidare l'adattamento attraverso timing, stimoli e nutrizione. Misurare il cambiamento e portarti alla vera performance.",
  ctaStart: "Inizia gratis",
  ctaDiscover: "Scopri la piattaforma",
} as const;
// ─────────────────────────────────────────────────────────────────────────────

export function HeroSection() {
  return (
    <section className="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col items-center justify-center px-4 sm:px-6">
      <div className="text-center">
        {/* Eyebrow chip */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-purple-200 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
          {HERO.eyebrow}
        </div>

        {/* Wordmark */}
        <h1 className="text-6xl font-black tracking-[0.12em] text-white sm:text-8xl lg:text-9xl">
          {HERO.title}
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-300 sm:mt-8">
          {HERO.subtitle}
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/registrati"
            className="empathy-btn-gradient inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-purple-500/50"
          >
            {HERO.ctaStart}
          </Link>
          <a
            href="#piattaforma"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3 text-sm font-medium text-gray-300 backdrop-blur-xl transition hover:border-purple-500/40 hover:text-white"
          >
            {HERO.ctaDiscover}
          </a>
        </div>
      </div>
    </section>
  );
}
