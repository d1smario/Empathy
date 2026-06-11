import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { getEmpathyAccountCatalog } from "@/lib/account/plan-catalog";
import { checkoutPayReady, hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { HomeStripePricing } from "./HomeStripePricing";
import { Navbar } from "./Navbar";
import { HeroSection } from "./hero/HeroSection";
import { WatchLabSection } from "./WatchLabSection";
import { PercorsoSection } from "./PercorsoSection";
import { CtaSection } from "./CtaSection";
import { FooterSection } from "./FooterSection";
// landing: hero + watch/animazione + percorso + cta + footer

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
          <HeroSection />
          <WatchLabSection />
          <PercorsoSection />
          <CtaSection />
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
            <p className="text-3xl font-black tracking-[0.12em] text-white sm:text-4xl">EMPATHY</p>
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
