import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Editable Italian copy for the final call-to-action band.
 * Edit the strings below to change the section text.
 */
const CTA_COPY = {
  eyebrow: "Inizia oggi",
  headline: "Pronto a misurare il cambiamento?",
  subtitle: "Crea il tuo account e porta i tuoi dati alla vera performance.",
  primaryCta: "Inizia gratis",
} as const;

export function CtaSection() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-24 sm:px-6 md:pt-32">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-600/20 via-pink-600/10 to-orange-600/20 px-6 py-14 text-center backdrop-blur-xl sm:px-12 sm:py-16">
        {/* Ambient glow accents */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-pink-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-orange-500/15 blur-3xl"
        />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-purple-200 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-orange-300" aria-hidden />
            {CTA_COPY.eyebrow}
          </span>

          <h2 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {CTA_COPY.headline}
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
            {CTA_COPY.subtitle}
          </p>

          <div className="mt-9 flex justify-center">
            <Link
              href="/registrati"
              className="empathy-btn-gradient group inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-purple-500/50"
            >
              {CTA_COPY.primaryCta}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
