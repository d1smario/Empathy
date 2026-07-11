import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";
import { HomeLinesBackdrop } from "./graphics/HomeLinesBackdrop";

/** Hero vetrina: emotivo, doppio pubblico, doppia CTA. */
export async function VetrinaHero() {
  const t = await getTranslations("Vetrina.home");
  return (
    <section className="relative mx-auto max-w-5xl px-1 pt-10 text-center sm:pt-16">
      <HomeLinesBackdrop />
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-pink-200">
          {t("heroEyebrow")}
        </span>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
          {t("heroTitle")}
        </h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-gray-400 sm:text-lg">
          {t("heroSub")}
        </p>
      </Reveal>
      <Reveal delay={240}>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/registrati"
            className="empathy-btn-gradient w-full rounded-full px-7 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 sm:w-auto"
          >
            {t("heroCtaPrimary")}
          </Link>
          <Link
            href="/come-funziona"
            className="w-full rounded-full border border-white/15 bg-white/5 px-7 py-3 text-sm font-semibold text-gray-200 backdrop-blur-xl transition-colors hover:border-purple-500/40 hover:text-white sm:w-auto"
          >
            {t("heroCtaSecondary")}
          </Link>
        </div>
      </Reveal>
      <Reveal delay={320}>
        <p className="mt-6 text-xs text-gray-600">{t("heroTrust")}</p>
      </Reveal>
    </section>
  );
}
