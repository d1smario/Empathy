import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";
import { HowEcgBackdrop } from "./graphics/HowEcgBackdrop";
import { LiveWatch } from "./graphics/LiveWatch";
import { GpsRouteMap } from "./graphics/GpsRouteMap";
import { PhysiologyChart } from "./graphics/PhysiologyChart";
import { AdaptiveLoadChart } from "./graphics/AdaptiveLoadChart";
import { NutritionMacros } from "./graphics/NutritionMacros";
import { TrainingChart } from "./graphics/TrainingChart";

const MODULES = [
  { t: "moduleTrainingTitle", b: "moduleTrainingBody", accent: "text-pink-300" },
  { t: "moduleNutritionTitle", b: "moduleNutritionBody", accent: "text-cyan-300" },
  { t: "modulePhysiologyTitle", b: "modulePhysiologyBody", accent: "text-violet-300" },
  { t: "moduleTwinTitle", b: "moduleTwinBody", accent: "text-amber-300" },
];

/** Contenuto pagina "Come funziona": step con grafici reali + showcase + moduli + CTA. */
export async function VetrinaHowItWorks() {
  const t = await getTranslations("Vetrina.how");

  const gpsLabels = {
    routeTitle: t("g.routeTitle"),
    elevation: t("g.elevation"),
    distance: t("g.distance"),
    elevGain: t("g.elevGain"),
    movingTime: t("g.movingTime"),
    avgSpeed: t("g.avgSpeed"),
    avgHr: t("g.avgHr"),
    avgPower: t("g.avgPower"),
  };
  const physioLabels = { physioTitle: t("g.physioTitle"), lactate: t("g.lactate"), threshold: t("g.threshold"), power: t("g.power") };
  const loadLabels = { loadTitle: t("g.loadTitle"), weeklyLoad: t("g.weeklyLoad"), readiness: t("g.readiness"), planAdapts: t("g.planAdapts"), weeksAgo: t("g.weeksAgo"), today: t("g.today") };
  const nutritionLabels = { nutritionTitle: t("g.nutritionTitle"), carbs: t("g.carbs"), protein: t("g.protein"), fat: t("g.fat"), calories: t("g.calories") };
  const trainingLabels = { trainingTitle: t("g.trainingTitle"), power: t("g.power"), hr: t("g.hr") };

  const steps = [
    { n: "01", t: "step1Title", b: "step1Body", graphic: <LiveWatch /> },
    { n: "02", t: "step2Title", b: "step2Body", graphic: <GpsRouteMap labels={gpsLabels} /> },
    { n: "03", t: "step3Title", b: "step3Body", graphic: <PhysiologyChart labels={physioLabels} /> },
    { n: "04", t: "step4Title", b: "step4Body", graphic: <AdaptiveLoadChart labels={loadLabels} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl px-1">
      {/* intro */}
      <section className="relative pt-10 text-center sm:pt-16">
        <HowEcgBackdrop />
        <Reveal>
          <span className="inline-flex rounded-full border border-pink-400/30 bg-pink-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-pink-200">
            {t("eyebrow")}
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl">
            {t("title")}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{t("sub")}</p>
        </Reveal>
      </section>

      {/* step con grafici reali */}
      <section className="mt-20 space-y-16 sm:mt-28 sm:space-y-24">
        {steps.map((s, i) => (
          <div key={s.n} className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
            <Reveal>
              <div>
                <span className="font-mono text-5xl font-black text-white/10">{s.n}</span>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t(s.t)}</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-400 sm:text-base">{t(s.b)}</p>
              </div>
            </Reveal>
            <Reveal delay={100}>{s.graphic}</Reveal>
          </div>
        ))}
      </section>

      {/* showcase: nutrizione + allenamento */}
      <section className="mt-28">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("showcaseTitle")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("showcaseSub")}</p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <Reveal>
            <NutritionMacros labels={nutritionLabels} />
          </Reveal>
          <Reveal delay={100}>
            <TrainingChart labels={trainingLabels} />
          </Reveal>
        </div>
        <p className="mt-4 text-center text-[11px] text-gray-600">{t("previewNote")}</p>
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
