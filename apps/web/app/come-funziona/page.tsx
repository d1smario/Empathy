import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Navbar } from "@/components/marketing/Navbar";
import { FooterSection } from "@/components/marketing/FooterSection";
import { VetrinaHowItWorks } from "@/components/marketing/vetrina/VetrinaHowItWorks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Vetrina.how");
  return {
    title: `${t("title")} — Empathy`,
    description: t("sub"),
    robots: { index: true, follow: true },
  };
}

export default function ComeFunzionaPage() {
  return (
    <BrutalistAppBackdrop matrix={false}>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="relative scroll-mt-0 px-4 pt-20 pb-12 outline-none sm:px-6">
        <VetrinaHowItWorks />
        <FooterSection />
      </main>
    </BrutalistAppBackdrop>
  );
}
