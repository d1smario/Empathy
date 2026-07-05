import { EMPATHY_PLATFORM_VERSION, type ProductModuleId } from "@empathy/contracts";
import { BookOpen, LayoutDashboard, Settings2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getEmpathyAccountCatalog } from "@/lib/account/plan-catalog";
import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { loadBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { checkoutPayReady, hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { DashboardIntroAndPricing } from "@/components/dashboard/DashboardIntroAndPricing";
import { DashboardPlanBadge } from "@/components/dashboard/DashboardPlanBadge";
import { NewDashboardView } from "@/components/dashboard/NewDashboardView";
import { CoachAthletesModulePanel } from "@/components/coach/CoachAthletesModulePanel";
import { SettingsCoachAccountCard } from "@/components/settings/SettingsCoachAccountCard";
import { SettingsAthleteContextDiagnostics } from "@/components/settings/SettingsAthleteContextDiagnostics";
import { SettingsAuthSessionDiagnostics } from "@/components/settings/SettingsAuthSessionDiagnostics";
import { SettingsBillingDiagnostics } from "@/components/settings/SettingsBillingDiagnostics";
import { SettingsBuildPhasesCard } from "@/components/settings/SettingsBuildPhasesCard";
import { SettingsDataSourcePreference } from "@/components/settings/SettingsDataSourcePreference";
import { SettingsDeviceIngestPolicy } from "@/components/settings/SettingsDeviceIngestPolicy";
import { SettingsDeviceManualSync } from "@/components/settings/SettingsDeviceManualSync";
import { SettingsLocalePreference } from "@/components/settings/SettingsLocalePreference";
import { SettingsIntegrationsDiagnostics } from "@/components/settings/SettingsIntegrationsDiagnostics";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { ActionBar, Pro2Link } from "@/components/ui/empathy";
import { PlatformAdminOnly } from "@/components/auth/PlatformAdminOnly";
import { StandardModuleSubnav } from "@/components/navigation/StandardModuleSubnav";
import { getModuleDomainPanel } from "@/core/navigation/module-domain-bridge";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { getProductNavItemByModule } from "@/core/navigation/module-registry";

/** Hub / coach / settings: shell e sezioni canone Pro 2 (`docs/PRO2_UI_PAGE_CANON.md`). */
export async function StandardModuleSurface({ module }: { module: ProductModuleId }) {
  const t = await getTranslations("StandardModuleSurface");
  const nav = getProductNavItemByModule(module);
  const title = nav?.label ?? module;
  const panel = getModuleDomainPanel(module);
  const dashboardCatalog = module === "dashboard" ? getEmpathyAccountCatalog() : null;
  const dashboardHosted = module === "dashboard" ? hostedCheckoutAvailability() : null;
  const dashboardPayReady = module === "dashboard" ? checkoutPayReady() : false;
  const dashboardTrialDays = module === "dashboard" ? readCheckoutTrialDays() : undefined;
  // Piani d'acquisto solo per chi non ha già un piano attivo: chi ha accesso
  // (abbonamento, grant beta/promo, ecc.) vede lo stato del proprio piano, non upsell.
  let dashboardEntitlement: UserAccessEntitlement | null = null;
  if (module === "dashboard") {
    const session = await getSessionProfile();
    dashboardEntitlement = session.userId ? await loadBillingEntitlementForAuthUser(session.userId) : null;
  }

  return (
    <Pro2ModulePageShell
      eyebrow={module === "dashboard" ? "Human Performance Operating System" : t("titleModuleSuffix", { title })}
      eyebrowClassName={moduleEyebrowClass(module)}
      title={
        module === "dashboard" ? (
          <>
            Understand Today.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Predict Tomorrow.
            </span>
          </>
        ) : (
          title
        )
      }
      description={
        module === "dashboard" ? undefined : module === "athletes" ? (
          <span className="text-sm text-gray-400">{t("athletesDescription")}</span>
        ) : panel ? (
          <span className="leading-relaxed">
            {t.rich("moduleEntryDescription", {
              code: (chunks) => <code className="text-gray-500">{chunks}</code>,
            })}
          </span>
        ) : undefined
      }
      headerActions={
        module === "dashboard" ? (
          dashboardEntitlement?.hasAthleteAccess ? (
            <DashboardPlanBadge entitlement={dashboardEntitlement} />
          ) : undefined
        ) : module === "athletes" ? undefined : (
          <>
            <Pro2Link href="/" variant="ghost" className="justify-center border border-white/15 bg-white/5 hover:bg-white/10">
              Home
            </Pro2Link>
            <Pro2Link
              href="/dashboard"
              variant="secondary"
              className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
            >
              Oggi & Domani
            </Pro2Link>
          </>
        )
      }
    >
      <div className="scroll-mt-28">
        {module === "dashboard" || module === "athletes" ? null : <StandardModuleSubnav />}
      </div>

      {module === "settings" ? (
        <section
          id="settings-coach-account"
          className="scroll-mt-28 space-y-6"
          aria-label={t("coachAccountRoleAria")}
        >
          <p className="text-center text-xs text-gray-500 sm:text-left">
            {t.rich("coachRoleNote", {
              role: (chunks) => <strong className="text-gray-300">{chunks}</strong>,
              access: (chunks) => <strong className="text-gray-400">{chunks}</strong>,
              scope: (chunks) => <strong className="text-gray-400">{chunks}</strong>,
              connections: (chunks) => <strong className="text-gray-400">{chunks}</strong>,
              operations: (chunks) => <strong className="text-gray-400">{chunks}</strong>,
            })}
          </p>
          <SettingsCoachAccountCard />
        </section>
      ) : null}

      {module === "dashboard" ? (
        dashboardEntitlement?.hasAthleteAccess ? (
          <NewDashboardView />
        ) : dashboardCatalog && dashboardHosted ? (
          <div className="space-y-12">
            <DashboardIntroAndPricing
              hosted={dashboardHosted}
              payReady={dashboardPayReady}
              basePlans={dashboardCatalog.basePlans}
              coachAddOns={dashboardCatalog.coachAddOns}
              trialPolicy={dashboardCatalog.trialPolicy}
              trialDaysConfigured={dashboardTrialDays}
              entitlement={dashboardEntitlement}
            />
          </div>
        ) : null
      ) : null}

      {module !== "dashboard" ? (
        <>
      {module !== "athletes" ? (
        <>
      <section id="std-domain" className="scroll-mt-28 space-y-10">
        {panel ? (
          <Pro2SectionCard accent="violet" title={t("contractualDomainTitle")} subtitle={panel.title} icon={BookOpen}>
            <p className="text-sm leading-relaxed text-gray-300">{panel.summary}</p>
            <p className="mt-4 font-mono text-xs text-gray-500">
              <span className="text-purple-400">package</span> {panel.packageId}
            </p>
          </Pro2SectionCard>
        ) : (
          <Pro2SectionCard accent="slate" title={t("domainTitle")} subtitle={t("notMappedSubtitle")} icon={BookOpen}>
            <p className="text-sm text-gray-400">{t("noDomainPanelMapped")}</p>
          </Pro2SectionCard>
        )}
      </section>

      <section id="std-links" className="scroll-mt-28">
        <Pro2SectionCard accent="cyan" title={t("connectionsTitle")} subtitle={t("quickNavigationSubtitle")} icon={LayoutDashboard}>
        <ActionBar className="border-0 pt-0" aria-label={t("quickNavigationAria")}>
          <Pro2Link href="/" variant="ghost">
            Home
          </Pro2Link>
          <Pro2Link href="/dashboard" variant="secondary">
            Dashboard
          </Pro2Link>
        </ActionBar>
        {module === "settings" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Pro2Link
              href="/dashboard"
              variant="secondary"
              className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
            >
              Dashboard
            </Pro2Link>
            <Pro2Link
              href="/training"
              variant="secondary"
              className="justify-center border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
            >
              Training
            </Pro2Link>
            <Pro2Link
              href="/profile"
              variant="secondary"
              className="justify-center border border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
            >
              Profile
            </Pro2Link>
          </div>
        ) : null}
        <p className="mt-6 font-mono text-xs text-gray-600">
          build <span className="text-purple-300">{EMPATHY_PLATFORM_VERSION}</span>
        </p>
        </Pro2SectionCard>
      </section>
        </>
      ) : null}

      <section id="std-ops" className="scroll-mt-28 space-y-10">
      {module === "athletes" ? <CoachAthletesModulePanel /> : null}

      {module === "settings" ? (
        <>
          {/**
           * Pannello "cliente": scelta provider per dominio + policy ingest.
           * Tutto il resto (auth/athlete diagnostics, build phases, billing/integrazioni env)
           * è interno e va dietro `PlatformAdminOnly` — no rumore tecnico, no impressione di
           * "spegnere" Stripe. (NB: l'enforcement reale della sottoscrizione è server-side.)
           */}
          <Pro2SectionCard
            accent="slate"
            title={t("myAccountDevicesTitle")}
            subtitle={t("myAccountDevicesSubtitle")}
            icon={Settings2}
          >
            <div className="flex flex-col gap-10">
              <SettingsLocalePreference />
              <SettingsDataSourcePreference />
              <SettingsDeviceManualSync />
              <SettingsDeviceIngestPolicy />
            </div>
          </Pro2SectionCard>

          <PlatformAdminOnly>
            <Pro2SectionCard
              accent="slate"
              title={t("diagnosticsAdminTitle")}
              subtitle={t("diagnosticsAdminSubtitle")}
              icon={Settings2}
            >
              <div className="flex flex-col gap-10">
                <SettingsBuildPhasesCard />
                <SettingsAuthSessionDiagnostics />
                <SettingsAthleteContextDiagnostics />
                <SettingsIntegrationsDiagnostics />
                <SettingsBillingDiagnostics />
              </div>
            </Pro2SectionCard>
          </PlatformAdminOnly>
        </>
      ) : null}
      </section>
        </>
      ) : null}
    </Pro2ModulePageShell>
  );
}
