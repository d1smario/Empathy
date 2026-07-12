import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

/** CTA finale della home: risultato concreto + unica azione. */
export async function VetrinaClosingCta() {
  const t = await getTranslations("Vetrina.home");
  return (
    <section className="mx-auto mt-28 max-w-4xl px-1">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 via-black/40 to-pink-600/20 p-8 text-center sm:p-12">
          <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-gray-100 sm:text-xl">
            {t("domainsResult")}
          </p>
          <Link
            href="/registrati"
            className="empathy-btn-gradient mt-7 inline-block rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25"
          >
            {t("domainsCta")}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
