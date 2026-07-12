import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Navbar } from "@/components/marketing/Navbar";
import { FooterSection } from "@/components/marketing/FooterSection";
import { VetrinaContactForm } from "@/components/marketing/vetrina/VetrinaContactForm";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Vetrina.contact");
  return publicPageMetadata({ title: `${t("title")} — Empathy`, description: t("sub"), path: "/contatti" });
}

export default async function ContattiPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const t = await getTranslations("Vetrina.contact");
  const initialKind = searchParams?.tab === "collabora" || searchParams?.tab === "collaborate" ? "collaborate" : "contact";

  return (
    <BrutalistAppBackdrop matrix={false}>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="relative scroll-mt-0 px-4 pt-20 pb-12 outline-none sm:px-6">
        <div className="mx-auto max-w-2xl">
          <section className="pt-10 text-center sm:pt-14">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">{t("title")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-gray-400 sm:text-base">{t("sub")}</p>
          </section>
          <section className="mt-10">
            <VetrinaContactForm initialKind={initialKind} />
          </section>
        </div>
        <FooterSection />
      </main>
    </BrutalistAppBackdrop>
  );
}
