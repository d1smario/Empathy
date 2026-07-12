import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

const DOMAINS = [
  { t: "domainFisiologia", b: "domainFisiologiaBody", icon: "🫀" },
  { t: "domainBiomeccanica", b: "domainBiomeccanicaBody", icon: "🦿" },
  { t: "domainCarico", b: "domainCaricoBody", icon: "📈" },
  { t: "domainNutrizione", b: "domainNutrizioneBody", icon: "🥗" },
  { t: "domainRecupero", b: "domainRecuperoBody", icon: "🌙" },
  { t: "domainLongevita", b: "domainLongevitaBody", icon: "∞" },
];

/** "Cosa analizziamo" — la profondità di un laboratorio in 6 domini. */
export async function VetrinaDomains() {
  const t = await getTranslations("Vetrina.home");
  return (
    <section className="mx-auto mt-28 max-w-6xl px-1">
      <Reveal className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("domainsTitle")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("domainsSub")}</p>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOMAINS.map((d, i) => (
          <Reveal key={d.t} delay={(i % 3) * 80}>
            <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-pink-400/30">
              <div className="text-2xl">{d.icon}</div>
              <h3 className="mt-3 text-base font-bold text-white">{t(d.t)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{t(d.b)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
