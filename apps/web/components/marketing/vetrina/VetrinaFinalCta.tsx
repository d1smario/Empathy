import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

/** CTA finale della home: prova gratis + contatti. */
export async function VetrinaFinalCta() {
  const t = await getTranslations("Vetrina.home");
  return (
    <section className="mx-auto mt-28 max-w-4xl px-1">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 via-black/40 to-pink-600/20 p-8 text-center sm:p-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">{t("finalCtaTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-gray-300 sm:text-base">{t("finalCtaSub")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/registrati"
              className="empathy-btn-gradient w-full rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 sm:w-auto"
            >
              {t("finalCtaPrimary")}
            </Link>
            <Link
              href="/contatti"
              className="w-full rounded-full border border-white/15 bg-white/5 px-8 py-3 text-sm font-semibold text-gray-200 transition-colors hover:border-purple-500/40 hover:text-white sm:w-auto"
            >
              {t("finalCtaSecondary")}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
