import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";
import { TelemetryHero } from "./graphics/TelemetryHero";
import { LiveWatch } from "./graphics/LiveWatch";
import { GpsRouteMap } from "./graphics/GpsRouteMap";
import { PhysiologyChart } from "./graphics/PhysiologyChart";
import { AdaptiveLoadChart } from "./graphics/AdaptiveLoadChart";
import { VetrinaOutcomes } from "./VetrinaOutcomes";

/** Contenuto pagina "Come funziona": step con grafici reali + outcomes + CTA. */
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
        <Reveal delay={240}>
          <div className="mt-10 sm:mt-12">
            <TelemetryHero />
          </div>
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

      {/* cosa ottieni davvero — showcase + moduli fusi */}
      <VetrinaOutcomes />

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
