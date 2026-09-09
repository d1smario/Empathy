import { EMPATHY_PLATFORM_VERSION, type ProductModuleId } from "@empathy/contracts";
import { BookOpen, LayoutDashboard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CoachAthletesModulePanel } from "@/components/coach/CoachAthletesModulePanel";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { ActionBar, Pro2Link } from "@/components/ui/empathy";
import { StandardModuleSubnav } from "@/components/navigation/StandardModuleSubnav";
import { getModuleDomainPanel } from "@/core/navigation/module-domain-bridge";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { getProductNavItemByModule } from "@/core/navigation/module-registry";

/**
 * Superficie per i moduli del registry SENZA pagina dedicata (`docs/PRO2_UI_PAGE_CANON.md`).
 *
 * In pratica riceve solo `athletes`: ogni altro segmento di `PRODUCT_MODULE_NAV` ha la sua
 * pagina sotto `app/(shell)/<segmento>/page.tsx`, che vince sul catch-all `[module]`. Il ramo
 * generico (dominio + collegamenti) resta come rete per un modulo aggiunto al registry prima
 * della sua pagina.
 *
 * NB: i rami `dashboard` e `settings` sono stati rimossi perché irraggiungibili — `/dashboard`
 * ha la sua pagina e `/settings` è un redirect a `/profile`.
 */
export async function StandardModuleSurface({ module }: { module: ProductModuleId }) {
  const t = await getTranslations("StandardModuleSurface");
  const nav = getProductNavItemByModule(module);
  const title = nav?.label ?? module;
  const panel = getModuleDomainPanel(module);
  const isAthletes = module === "athletes";

  return (
    <Pro2ModulePageShell
      eyebrow={t("titleModuleSuffix", { title })}
      eyebrowClassName={moduleEyebrowClass(module)}
      title={title}
      description={
        isAthletes ? (
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
        isAthletes ? undefined : (
          <>
            <Pro2Link href="/" variant="ghost" className="justify-center border border-white/15 bg-white/5 hover:bg-white/10">
              Home
            </Pro2Link>
            <Pro2Link
              href="/dashboard"
              variant="secondary"
              className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
            >
              Oggi &amp; Domani
            </Pro2Link>
          </>
        )
      }
    >
      <div className="scroll-mt-28">{isAthletes ? null : <StandardModuleSubnav />}</div>

      {isAthletes ? null : (
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
              <p className="mt-6 font-mono text-xs text-gray-600">
                build <span className="text-purple-300">{EMPATHY_PLATFORM_VERSION}</span>
              </p>
            </Pro2SectionCard>
          </section>
        </>
      )}

      <section id="std-ops" className="scroll-mt-28 space-y-10">
        {isAthletes ? <CoachAthletesModulePanel /> : null}
      </section>
    </Pro2ModulePageShell>
  );
}
