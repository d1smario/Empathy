import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";
import { EngineHud } from "./graphics/EngineHud";
import { HeroVideo } from "./graphics/HeroVideo";

/**
 * Hero cinematografico: video di un atleta reale (self-hosted) a tutta larghezza +
 * la "vista del motore" Empathy (EngineHud) accanto. Comunica: corpo che si muove,
 * sistema che vede i dati e adatta il piano.
 */
export async function VetrinaHeroCinematic() {
  const t = await getTranslations("Vetrina.home");
  return (
    <section className="relative -mx-4 -mt-20 flex min-h-[100svh] items-center overflow-hidden sm:-mx-6">
      {/* video di sfondo (self-hosted): crossfade-loop a doppio buffer + slow-mo, pronto al multi-clip.
          scale per rifilare eventuali margini/watermark della sorgente. */}
      <HeroVideo
        clips={["/hero/cyclist.mp4", "/hero/running.mp4", "/hero/gym.mp4"]}
        poster="/hero/cyclist-poster.jpg"
        className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-center"
      />

      {/* overlay per leggibilità */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0a0f] to-transparent" aria-hidden />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* colonna testo */}
        <div className="text-center lg:text-left">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-pink-200 backdrop-blur-xl">
              {t("heroEyebrow")}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-black leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl lg:mx-0">
              {t("heroTitle")}
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-gray-200 sm:text-lg lg:mx-0">
              {t("heroSub")}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/registrati"
                className="empathy-btn-gradient w-full rounded-full px-7 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 sm:w-auto"
              >
                {t("heroCtaPrimary")}
              </Link>
              <Link
                href="/come-funziona"
                className="w-full rounded-full border border-white/20 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:border-purple-500/40 sm:w-auto"
              >
                {t("heroCtaSecondary")}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <p className="mt-6 text-xs text-gray-400">{t("heroTrust")}</p>
          </Reveal>
        </div>

        {/* colonna HUD motore */}
        <Reveal delay={200} className="flex justify-center lg:justify-end">
          <EngineHud />
        </Reveal>
      </div>
    </section>
  );
}
