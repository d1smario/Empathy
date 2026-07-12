import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { getEmpathyAccountCatalog } from "@/lib/account/plan-catalog";
import { checkoutPayReady, hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { HomeStripePricing } from "./HomeStripePricing";
import { Navbar } from "./Navbar";
import { WatchLabSection } from "./WatchLabSection";
import { FooterSection } from "./FooterSection";
import { VetrinaHeroCinematic } from "./vetrina/VetrinaHeroCinematic";
import { VetrinaAudience } from "./vetrina/VetrinaAudience";
import { VetrinaProblems } from "./vetrina/VetrinaProblems";
import { VetrinaAdaptiveIntelligence } from "./vetrina/VetrinaAdaptiveIntelligence";
import { VetrinaTryIt } from "./vetrina/VetrinaTryIt";
import { VetrinaDomains } from "./vetrina/VetrinaDomains";
import { VetrinaClosingCta } from "./vetrina/VetrinaClosingCta";
// landing: hero → per chi è → problemi → watch-lab → cerchio adattivo → domini → cta → footer

type EmpathyPublicHomeProps = {
  billingFlash?: "success" | "cancel";
  /** Pagina `/pricing`: stesso blocco piani, intestazione più corta. */
  variant?: "landing" | "pricing-page";
};

export async function EmpathyPublicHome({ billingFlash, variant = "landing" }: EmpathyPublicHomeProps) {
  const catalog = getEmpathyAccountCatalog();
  const hosted = hostedCheckoutAvailability();
  const payReady = checkoutPayReady();
  const trialDaysConfigured = readCheckoutTrialDays();
  const t = await getTranslations("Marketing");

  if (variant !== "pricing-page") {
    return (
      <BrutalistAppBackdrop matrix={variant === "landing"}>
        <Navbar />

        <main
          id="main-content"
          tabIndex={-1}
          className="relative scroll-mt-0 px-4 outline-none sm:px-6 pt-20 pb-12"
        >
          <VetrinaHeroCinematic />
          <WatchLabSection />
          <VetrinaDomains />
          <VetrinaAdaptiveIntelligence />
          <VetrinaTryIt />
          <VetrinaProblems />
          <VetrinaAudience />
          <VetrinaClosingCta />
          <FooterSection />
        </main>
      </BrutalistAppBackdrop>
    );
  }

  // `variant` is narrowed to "pricing-page" here (the "landing" case returned above).
  return (
    <BrutalistAppBackdrop matrix={false}>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative scroll-mt-0 px-4 outline-none sm:px-6 py-12 sm:py-16 md:py-24"
      >
        <div className="relative mx-auto max-w-4xl">
          <header className="mb-10 border-b border-white/10 pb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/empathy-wordmark-white.png" alt="Empathy" className="h-9 w-auto sm:h-10" />
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">{t("pitch")}</p>
            <p className="mt-3 text-sm text-gray-500">
              <Link href="/" className="text-pink-300 underline-offset-4 hover:underline">
                {t("backHome")}
              </Link>
            </p>
          </header>

          <HomeStripePricing
            availability={hosted}
            payReady={payReady}
            basePlans={catalog.basePlans}
            coachAddOns={catalog.coachAddOns}
            trialPolicy={catalog.trialPolicy}
            trialDaysConfigured={trialDaysConfigured}
            billingFlash={billingFlash}
            compactIntro
          />
        </div>
      </main>
    </BrutalistAppBackdrop>
  );
}
