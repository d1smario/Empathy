import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";
import { AppMockup } from "./AppMockup";

const STEPS = [
  { n: "01", t: "step1Title", b: "step1Body", mock: "training" as const },
  { n: "02", t: "step2Title", b: "step2Body", mock: "physiology" as const },
  { n: "03", t: "step3Title", b: "step3Body", mock: "training" as const },
  { n: "04", t: "step4Title", b: "step4Body", mock: "nutrition" as const },
];

const MODULES = [
  { t: "moduleTrainingTitle", b: "moduleTrainingBody", accent: "text-pink-300" },
  { t: "moduleNutritionTitle", b: "moduleNutritionBody", accent: "text-cyan-300" },
  { t: "modulePhysiologyTitle", b: "modulePhysiologyBody", accent: "text-violet-300" },
  { t: "moduleTwinTitle", b: "moduleTwinBody", accent: "text-amber-300" },
];

/** Contenuto pagina "Come funziona": step alternati con mockup + moduli + CTA. */
export async function VetrinaHowItWorks() {
  const t = await getTranslations("Vetrina.how");
  return (
    <div className="mx-auto max-w-6xl px-1">
      {/* intro */}
      <section className="pt-10 text-center sm:pt-16">
        <Reveal>
          <span className="inline-flex rounded-full border border-pink-400/30 bg-pink-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-pink-200">
            {t("eyebrow")}
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">
            {t("title")}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{t("sub")}</p>
        </Reveal>
      </section>

      {/* step alternati */}
      <section className="mt-20 space-y-16 sm:mt-28 sm:space-y-24">
        {STEPS.map((s, i) => (
          <div key={s.n} className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
            <Reveal>
              <div>
                <span className="font-mono text-5xl font-black text-white/10">{s.n}</span>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t(s.t)}</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-400 sm:text-base">{t(s.b)}</p>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <AppMockup variant={s.mock} />
            </Reveal>
          </div>
        ))}
      </section>

      {/* moduli */}
      <section className="mt-28">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("modulesTitle")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("modulesSub")}</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <Reveal key={m.t} delay={i * 70}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className={`text-base font-bold ${m.accent}`}>{t(m.t)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{t(m.b)}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] text-gray-600">{t("previewNote")}</p>
      </section>

      {/* cta */}
      <section className="mt-24">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-8 text-center sm:p-10">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-gray-300">{t("ctaBody")}</p>
            <Link
              href="/registrati"
              className="empathy-btn-gradient mt-6 inline-block rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25"
            >
              {t("cta")}
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
