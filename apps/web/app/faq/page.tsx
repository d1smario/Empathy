import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Navbar } from "@/components/marketing/Navbar";
import { FooterSection } from "@/components/marketing/FooterSection";
import { VetrinaFaqList } from "@/components/marketing/vetrina/VetrinaFaqList";
import { VetrinaEventsList } from "@/components/marketing/vetrina/VetrinaEventsList";
import { loadPublishedFaq } from "@/lib/marketing/faq";
import { loadPublishedUpcomingEvents } from "@/lib/marketing/events";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Vetrina.faq");
  return { title: `${t("title")} — Empathy`, description: t("sub"), robots: { index: true, follow: true } };
}

export default async function FaqPage() {
  const locale = await resolveRequestLocale();
  const t = await getTranslations("Vetrina.faq");
  const te = await getTranslations("Vetrina.events");
  const [items, events] = await Promise.all([loadPublishedFaq(locale), loadPublishedUpcomingEvents(locale)]);

  return (
    <BrutalistAppBackdrop matrix={false}>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="relative scroll-mt-0 px-4 pt-20 pb-12 outline-none sm:px-6">
        <div className="mx-auto max-w-4xl">
          <section className="pt-10 text-center sm:pt-14">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">{t("title")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-gray-400 sm:text-base">{t("sub")}</p>
          </section>

          <section className="mt-12">
            <h2 className="mb-4 text-lg font-black tracking-tight text-white sm:text-xl">{t("faqHeading")}</h2>
            <VetrinaFaqList items={items} />
          </section>

          {/* prossimi eventi */}
          <section className="mt-16">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{te("title")}</h2>
            <p className="mt-2 max-w-xl text-sm text-gray-400 sm:text-base">{te("sub")}</p>
            <div className="mt-8">
              <VetrinaEventsList items={events} />
            </div>
          </section>

          {/* ultimo box: contattaci */}
          <section className="mt-20">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/15 to-pink-600/15 p-8 text-center">
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">{t("ctaTitle")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-300">{t("ctaBody")}</p>
              <Link
                href="/contatti"
                className="empathy-btn-gradient mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25"
              >
                {t("cta")}
              </Link>
            </div>
          </section>
        </div>
        <FooterSection />
      </main>
    </BrutalistAppBackdrop>
  );
}
