import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

const ITEMS = [
  { t: "problem1Title", b: "problem1Body", s: "problem1Solution" },
  { t: "problem2Title", b: "problem2Body", s: "problem2Solution" },
  { t: "problem3Title", b: "problem3Body", s: "problem3Solution" },
];

/** "I problemi che risolviamo" — coppie problema → risposta, il cuore del value prop. */
export async function VetrinaProblems() {
  const t = await getTranslations("Vetrina.home");
  return (
    <section className="mx-auto mt-28 max-w-5xl px-1">
      <Reveal className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("problemsTitle")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("problemsSub")}</p>
      </Reveal>
      <div className="mt-12 space-y-5">
        {ITEMS.map((it, i) => (
          <Reveal key={i} delay={i * 90}>
            <div className="grid items-stretch gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-2">
              <div className="bg-black/30 p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("problemLabel")}</p>
                <p className="mt-2 text-lg font-bold text-white">{t(it.t)}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{t(it.b)}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-300/80">{t("solutionLabel")}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-200">{t(it.s)}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
