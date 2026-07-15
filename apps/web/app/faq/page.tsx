import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Navbar } from "@/components/marketing/Navbar";
import { FooterSection } from "@/components/marketing/FooterSection";
import { VetrinaFaqList } from "@/components/marketing/vetrina/VetrinaFaqList";
import { VetrinaEventsList } from "@/components/marketing/vetrina/VetrinaEventsList";
import { VetrinaContactForm } from "@/components/marketing/vetrina/VetrinaContactForm";
import { loadPublishedFaq } from "@/lib/marketing/faq";
import { loadPublishedUpcomingEvents } from "@/lib/marketing/events";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import { publicPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Vetrina.faq");
  return publicPageMetadata({ title: `${t("title")} — Empathy`, description: t("sub"), path: "/faq" });
}

export default async function FaqPage() {
  const locale = await resolveRequestLocale();
  const t = await getTranslations("Vetrina.faq");
  const te = await getTranslations("Vetrina.events");
  const tc = await getTranslations("Vetrina.contact");
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

          {/* ultima sezione: contatti (stesso form di /contatti) */}
          <section className="mt-20">
            <div className="mx-auto max-w-2xl">
              <div className="text-center">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{tc("title")}</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm text-gray-400 sm:text-base">{tc("sub")}</p>
              </div>
              <div className="mt-8">
                <VetrinaContactForm />
              </div>
            </div>
          </section>
        </div>
        <FooterSection />
      </main>
    </BrutalistAppBackdrop>
  );
}
