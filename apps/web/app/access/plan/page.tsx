import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { WatchLabSection } from "@/components/marketing/WatchLabSection";
import { BillingProfileLauncher } from "@/components/access/BillingProfileLauncher";
import { PlanLogoutButton } from "@/components/access/PlanLogoutButton";
import { SignupCheckoutWelcome } from "@/components/access/SignupCheckoutWelcome";
import { SignupPlanCards } from "@/components/access/SignupPlanCards";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { ensureBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Subscription — Empathy",
  robots: { index: false, follow: false },
};

/**
 * Gate post-registrazione atleta: prova gratuita (se configurata) o abbonamento Stripe.
 * Richiede sessione; coach → `/athletes`; già con accesso atleta → dashboard.
 */
export default async function AccessPlanPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!getSupabasePublicConfig()) {
    redirect("/access?error=config");
  }

  const sb = createSupabaseCookieClient();
  if (!sb) redirect("/access?error=config");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    redirect("/access?next=%2Faccess%2Fplan");
  }

  const { data: prof } = await sb.from("app_user_profiles").select("role").eq("user_id", user.id).maybeSingle();
  const role = (prof as { role?: string } | null)?.role;
  if (role === "coach") {
    redirect("/athletes");
  }

  const isCheckoutSuccess = firstSearchParam(searchParams?.billing) === "success";
  const checkoutSessionId = firstSearchParam(searchParams?.session_id);

  const entitlement = await ensureBillingEntitlementForAuthUser(user.id, user.email ?? null, {
    checkoutSessionId,
    repairFromStripe: true,
  });

  if (entitlement.hasAthleteAccess && isCheckoutSuccess) {
    redirect("/dashboard?welcome=1");
  }

  if (entitlement.hasAthleteAccess && !isCheckoutSuccess) {
    redirect("/dashboard");
  }

  const t = await getTranslations("AccessPlan");
  const billingFlash =
    searchParams?.billing === "success"
      ? ("success" as const)
      : searchParams?.billing === "cancel"
        ? ("cancel" as const)
        : undefined;
  const showRequired =
    typeof searchParams?.required === "string" && searchParams.required === "subscription";

  const meta = user.user_metadata as Record<string, unknown>;
  const firstName = typeof meta?.first_name === "string" && meta.first_name.trim() ? meta.first_name.trim() : null;

  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative mx-auto max-w-6xl scroll-mt-0 px-4 py-12 outline-none sm:px-6 sm:py-16"
      >
        <header className="relative pt-12 text-center sm:pt-0">
          {/* Icona profilo: anagrafica fatturazione in un modale. */}
          <div className="absolute right-0 top-0 mr-0 sm:mr-2">
            <BillingProfileLauncher />
          </div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-gray-500">
            {isCheckoutSuccess
              ? t("welcomeEyebrow")
              : firstName
                ? t("greetingNamed", { name: firstName })
                : t("greeting")}
          </p>
          <h1 className="mx-auto mt-4 max-w-4xl bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-3xl font-black leading-[1.05] tracking-tight text-transparent sm:text-4xl lg:text-5xl xl:text-6xl">
            {isCheckoutSuccess ? t("welcomeTitle") : t("title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400">
            {isCheckoutSuccess ? t("welcomeBody") : t("subtitle")}
          </p>
          {showRequired && !isCheckoutSuccess ? (
            <p
              className="mx-auto mt-5 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              role="alert"
            >
              {t("requiredAlert")}
            </p>
          ) : null}
        </header>

        {isCheckoutSuccess ? (
          <div className="mt-10">
            <SignupCheckoutWelcome
              checkoutSessionId={checkoutSessionId ?? null}
              initialReady={entitlement.hasAthleteAccess}
              initialLabel={entitlement.hasAthleteAccess ? entitlement.label : null}
            />
          </div>
        ) : (
          <>
            {/* Sezione emozionale: orologio dati live + animazione (riuso home). */}
            <WatchLabSection id="account-lab" compact />

            <div className="border-t border-white/10 pt-10">
              <SignupPlanCards billingFlash={billingFlash} />
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-3 border-t border-white/10 pt-6 sm:justify-start">
              <PlanLogoutButton />
            </div>
          </>
        )}
      </main>
    </BrutalistAppBackdrop>
  );
}
