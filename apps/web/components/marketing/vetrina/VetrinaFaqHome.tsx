import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadPublishedFaq } from "@/lib/marketing/faq";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import { Reveal } from "./Reveal";
import { VetrinaFaqList } from "./VetrinaFaqList";

/**
 * FAQ compatta in home: le prime voci pubblicate (STESSA fonte DB di /faq) + link alla FAQ
 * completa. Ammazza-obiezioni subito prima della CTA finale. Include JSON-LD FAQPage (SEO).
 * Se non ci sono FAQ pubblicate la sezione sparisce (niente sezione vuota in home).
 */
export async function VetrinaFaqHome() {
  const locale = await resolveRequestLocale();
  const t = await getTranslations("Vetrina.faq");
  const all = await loadPublishedFaq(locale);
  const items = all.slice(0, 5);
  if (items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };

  return (
    <section className="mx-auto mt-24 max-w-3xl px-1 sm:mt-28">
      <Reveal className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("faqHeading")}</h2>
      </Reveal>
      <Reveal delay={80} className="mt-10">
        <VetrinaFaqList items={items} />
      </Reveal>
      <Reveal delay={140} className="mt-8 text-center">
        <Link
          href="/faq"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pink-300 underline-offset-4 transition-colors hover:text-pink-200 hover:underline"
        >
          {t("allLink")} <span aria-hidden>→</span>
        </Link>
      </Reveal>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
