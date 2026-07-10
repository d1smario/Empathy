import { EMPATHY_PLATFORM_VERSION, type ProductModuleId } from "@empathy/contracts";
import { BookOpen, CalendarDays, LineChart, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { GenerativeFocusIsland } from "@/components/generative/GenerativeFocusIsland";
import { FaseModuleStubCard } from "@/components/navigation/FaseModuleStubCard";
import { ModuleCrossLinksCard } from "@/components/navigation/ModuleCrossLinksCard";
import { HealthBiomarkerPanelsCard } from "@/components/health/HealthBiomarkerPanelsCard";
import { NutritionAthleteSummaryCard } from "@/components/nutrition/NutritionAthleteSummaryCard";
import { PhysiologyProfileStripCard } from "@/components/physiology/PhysiologyProfileStripCard";
import { ProfileAthleteCard } from "@/components/profile/ProfileAthleteCard";
import { TrainingPlannedWindowCard } from "@/components/training/TrainingPlannedWindowCard";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard, type Pro2SectionAccent } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { getModuleDomainPanel } from "@/core/navigation/module-domain-bridge";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { getProductNavItemByModule } from "@/core/navigation/module-registry";

function domainAccent(module: ProductModuleId): Pro2SectionAccent {
  switch (module) {
    case "today":
      return "cyan";
    case "analysis":
      return "fuchsia";
    case "profile":
      return "fuchsia";
    case "training":
      return "orange";
    case "nutrition":
      return "amber";
    case "bioenergetics":
      return "emerald";
    case "physiology":
      return "emerald";
    case "health":
      return "violet";
    case "biomechanics":
      return "emerald";
    case "aerodynamics":
      return "cyan";
    case "longevity":
      return "fuchsia";
    case "dashboard":
    case "calendario":
    case "athletes":
    case "commissioni":
    case "settings":
      return "slate";
  }
}

/**
 * Moduli generativi: stessa shell del Builder; sezioni card + focus island (densità controllata da `empathy_pro2_ui_language.mdc`).
 */
export async function GenerativeModuleSurface({ module }: { module: ProductModuleId }) {
  const t = await getTranslations("GenerativeModuleSurface");
  const nav = getProductNavItemByModule(module);
  const title = nav?.label ?? module;
  const panel = getModuleDomainPanel(module);
  const accent = domainAccent(module);

  return (
    <Pro2ModulePageShell
      eyebrow={`${title} · Focus`}
      eyebrowClassName={moduleEyebrowClass(module)}
      title={title}
      description={
        <p className="leading-relaxed">{t("surfaceDescription")}</p>
      }
      headerActions={
        <>
          <Pro2Link
            href="/dashboard"
            variant="secondary"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
          >
            Hub
          </Pro2Link>
          <Pro2Link href="/" variant="ghost" className="justify-center border border-white/15 bg-white/5 hover:bg-white/10">
            Home
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <GenerativeModuleSubnav />
      </div>

      <section id="gen-domain" className="scroll-mt-28">
        {panel ? (
          <Pro2SectionCard accent={accent} title={t("moduleScopeTitle")} subtitle={panel.title} icon={BookOpen}>
            <p className="text-sm leading-relaxed text-gray-300">{panel.summary}</p>
            <p className="mt-3 font-mono text-xs text-gray-500">
              <span className="text-purple-400">package</span> {panel.packageId}
            </p>
          </Pro2SectionCard>
        ) : (
          <Pro2SectionCard accent="slate" title={t("moduleScopeTitle")} subtitle={t("notMapped")} icon={BookOpen}>
            <p className="text-sm text-gray-400">{t("noDomainPanel")}</p>
          </Pro2SectionCard>
        )}
      </section>

      <section id="gen-body" className="scroll-mt-28 space-y-10">
      {module === "profile" ? (
        <Pro2SectionCard accent="fuchsia" title={t("athleteProfileTitle")} subtitle={t("contractRead")} icon={BookOpen}>
          <div className="flex justify-center sm:justify-start">
            <ProfileAthleteCard />
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "training" ? (
        <Pro2SectionCard accent="orange" title="Training" subtitle={t("plannedWindow")} icon={BookOpen}>
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-start">
            <TrainingPlannedWindowCard />
            <div className="flex flex-col gap-2 sm:justify-center">
              {/* Builder/Virya sono strumenti coach (via subnav Training, gated). Qui solo Calendar. */}
              <Pro2Link
                href="/training/calendar"
                variant="secondary"
                className="justify-center border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/15"
              >
                Calendar
              </Pro2Link>
            </div>
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "nutrition" ? (
        <>
          <Pro2SectionCard accent="amber" title="Nutrition" subtitle={t("constraintsAndPlans")} icon={BookOpen}>
            <div className="flex justify-center sm:justify-start">
              <NutritionAthleteSummaryCard />
            </div>
          </Pro2SectionCard>
          <Pro2SectionCard
            accent="orange"
            title={t("loadAlignmentTitle")}
            subtitle={t("loadAlignmentSubtitle")}
            icon={CalendarDays}
          >
            <p className="text-sm leading-relaxed text-gray-400">{t("loadAlignmentBody")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pro2Link
                href="/training/calendar"
                variant="secondary"
                className="justify-center border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/15"
              >
                Calendar
              </Pro2Link>
              <Pro2Link
                href="/training/analytics"
                variant="secondary"
                className="justify-center border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15"
              >
                <span className="inline-flex items-center gap-1.5">
                  <LineChart className="h-4 w-4" aria-hidden />
                  Analyzer
                </span>
              </Pro2Link>
              <Pro2Link
                href="/physiology"
                variant="ghost"
                className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
              >
                Physiology
              </Pro2Link>
            </div>
          </Pro2SectionCard>
        </>
      ) : null}

      {module === "bioenergetics" ? (
        <Pro2SectionCard
          accent="emerald"
          title="BioEnergetic Intelligence"
          subtitle={t("bioenergeticsSubtitle")}
          icon={LineChart}
        >
          <p className="text-sm leading-relaxed text-gray-400">{t("bioenergeticsBody")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pro2Link
              href="/bioenergetics"
              variant="secondary"
              className="justify-center border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25"
            >
              {t("dailyReportCharts")}
            </Pro2Link>
            <Pro2Link
              href="/nutrition/meal-plan"
              variant="secondary"
              className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
            >
              {t("foodDiary")}
            </Pro2Link>
            <Pro2Link
              href="/training/calendar"
              variant="secondary"
              className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15"
            >
              Calendar
            </Pro2Link>
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "physiology" ? (
        <Pro2SectionCard accent="emerald" title="Physiology" subtitle={t("physiologicalProfile")} icon={BookOpen}>
          <div className="flex justify-center sm:justify-start">
            <PhysiologyProfileStripCard />
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "health" ? (
        <Pro2SectionCard accent="violet" title="Health & Bio" subtitle={t("biomarkerPanels")} icon={BookOpen}>
          <div className="flex justify-center sm:justify-start">
            <HealthBiomarkerPanelsCard />
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "biomechanics" ? (
        <Pro2SectionCard accent="emerald" title="Biomechanics" subtitle="Roadmap" icon={BookOpen}>
          <div className="flex justify-center sm:justify-start">
            <FaseModuleStubCard
              accentClass="text-emerald-300/90"
              kicker="Biomechanics · roadmap"
              title={t("kinematicDataTitle")}
              body={t("kinematicDataBody")}
            />
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "aerodynamics" ? (
        <Pro2SectionCard accent="cyan" title="Aerodynamics" subtitle="Roadmap" icon={BookOpen}>
          <div className="flex justify-center sm:justify-start">
            <FaseModuleStubCard
              accentClass="text-cyan-300/90"
              kicker="Aerodynamics · roadmap"
              title={t("cdaWindContextTitle")}
              body={t("cdaWindContextBody")}
            />
          </div>
        </Pro2SectionCard>
      ) : null}
      </section>

      <section id="gen-cross" className="scroll-mt-28">
        <ModuleCrossLinksCard module={module} />
      </section>

      <section id="gen-focus" className="scroll-mt-28 space-y-6">
        <Pro2SectionCard accent="fuchsia" title={t("actionsTitle")} subtitle={t("actionsSubtitle")} icon={Sparkles}>
          <GenerativeFocusIsland module={module} />
        </Pro2SectionCard>

        <p className="text-center font-mono text-[0.65rem] text-gray-600">
          {EMPATHY_PLATFORM_VERSION}
          {panel ? (
            <>
              {" · "}
              <span className="text-gray-500">{panel.packageId}</span>
            </>
          ) : null}
        </p>
      </section>
    </Pro2ModulePageShell>
  );
}
