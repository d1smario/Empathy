import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

const POINTS = [
  { n: "01", t: "p1Title", b: "p1Body", accent: "text-pink-300", dot: "bg-pink-400" },
  { n: "02", t: "p2Title", b: "p2Body", accent: "text-cyan-300", dot: "bg-cyan-400" },
  { n: "03", t: "p3Title", b: "p3Body", accent: "text-amber-300", dot: "bg-amber-400" },
];

/**
 * Sezione "cuore" della vetrina: l'intelligenza adattiva spiegata come BENEFICIO
 * (niente gergo "twin/motori"). Usata sia in home sia in "come funziona". Namespace
 * proprio `Vetrina.adaptive` così è riusabile su entrambe le pagine.
 */
export async function VetrinaAdaptiveIntelligence() {
  const t = await getTranslations("Vetrina.adaptive");
  return (
    <section className="relative mx-auto mt-24 max-w-5xl px-1 sm:mt-28">
      <div className="pointer-events-none absolute -inset-x-10 -inset-y-6 -z-10 rounded-[3rem] bg-gradient-to-br from-purple-600/10 via-transparent to-pink-600/10 blur-2xl" aria-hidden />

      <Reveal className="text-center">
        <h2 className="mx-auto max-w-3xl text-balance text-3xl font-black leading-[1.12] tracking-tight text-white sm:text-[2.6rem]">
          {t("title")}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-gray-400 sm:text-lg">{t("sub")}</p>
      </Reveal>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {POINTS.map((p, i) => (
          <Reveal key={p.n} delay={i * 90}>
            <div className="relative h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                <span className="font-mono text-xs text-white/30">{p.n}</span>
              </div>
              <h3 className={`mt-3 text-base font-black tracking-tight ${p.accent}`}>{t(p.t)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{t(p.b)}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <p className="mt-8 text-center text-lg font-bold text-white sm:text-xl">{t("closing")}</p>
      </Reveal>
    </section>
  );
}
