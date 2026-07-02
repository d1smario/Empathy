"use client";

import { useTranslations } from "next-intl";

import { HomeStripePricing } from "@/components/marketing/HomeStripePricing";
import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import type { HostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import type { EmpathyPlanCatalogItem, EmpathyTrialPolicy } from "@empathy/contracts";

type DashboardIntroAndPricingProps = {
  hosted: HostedCheckoutAvailability;
  payReady: boolean;
  basePlans: EmpathyPlanCatalogItem[];
  coachAddOns: EmpathyPlanCatalogItem[];
  trialPolicy: EmpathyTrialPolicy;
  trialDaysConfigured?: number;
  /** Entitlement utente: con accesso attivo niente upsell, solo lo stato del piano. */
  entitlement?: UserAccessEntitlement | null;
};

export function DashboardIntroAndPricing({
  hosted,
  payReady,
  basePlans,
  coachAddOns,
  trialPolicy,
  trialDaysConfigured,
  entitlement,
}: DashboardIntroAndPricingProps) {
  const t = useTranslations("DashboardIntroAndPricing");
  // Chi ha già un piano attivo non vede le opzioni d'acquisto: il badge del piano
  // sta nell'header (DashboardPlanBadge), qui non si rende nulla. Solo chi non ha
  // accesso vede i piani da acquistare.
  if (entitlement?.hasAthleteAccess) return null;

  return (
    <section id="dash-intro" className="scroll-mt-28 space-y-8 rounded-2xl border border-white/10 bg-black/20 p-6 sm:p-8">
      <div>
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-300/90">{t("forYou")}</p>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">{t("empathyPitch")}</p>
      </div>
      <HomeStripePricing
        sectionId="dashboard-piani"
        hideSectionTitle
        availability={hosted}
        payReady={payReady}
        basePlans={basePlans}
        coachAddOns={coachAddOns}
        trialPolicy={trialPolicy}
        trialDaysConfigured={trialDaysConfigured}
      />
    </section>
  );
}
