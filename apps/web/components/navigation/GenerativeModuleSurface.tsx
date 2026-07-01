import { EMPATHY_PLATFORM_VERSION, type ProductModuleId } from "@empathy/contracts";
import { BookOpen, CalendarDays, LineChart, Sparkles } from "lucide-react";
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
export function GenerativeModuleSurface({ module }: { module: ProductModuleId }) {
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
        <p className="leading-relaxed">
          Pro 2 generative surface: domain summary in the panel below, operational data in the center, a guided focus at the bottom.
        </p>
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
          <Pro2SectionCard accent={accent} title="Module scope" subtitle={panel.title} icon={BookOpen}>
            <p className="text-sm leading-relaxed text-gray-300">{panel.summary}</p>
            <p className="mt-3 font-mono text-xs text-gray-500">
              <span className="text-purple-400">package</span> {panel.packageId}
            </p>
          </Pro2SectionCard>
        ) : (
          <Pro2SectionCard accent="slate" title="Module scope" subtitle="Not mapped" icon={BookOpen}>
            <p className="text-sm text-gray-400">No domain panel for this module.</p>
          </Pro2SectionCard>
        )}
      </section>

      <section id="gen-body" className="scroll-mt-28 space-y-10">
      {module === "profile" ? (
        <Pro2SectionCard accent="fuchsia" title="Athlete profile" subtitle="Contract read" icon={BookOpen}>
          <div className="flex justify-center sm:justify-start">
            <ProfileAthleteCard />
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "training" ? (
        <Pro2SectionCard accent="orange" title="Training" subtitle="Planned window" icon={BookOpen}>
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-start">
            <TrainingPlannedWindowCard />
            <div className="flex flex-col gap-2 sm:justify-center">
              <Pro2Link
                href="/training/builder"
                variant="secondary"
                className="justify-center border border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
              >
                Open builder (dense view)
              </Pro2Link>
              <Pro2Link
                href="/training/calendar"
                variant="secondary"
                className="justify-center border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/15"
              >
                Calendar
              </Pro2Link>
              <Pro2Link
                href="/training/vyria"
                variant="ghost"
                className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
              >
                Virya · annual
              </Pro2Link>
            </div>
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "nutrition" ? (
        <>
          <Pro2SectionCard accent="amber" title="Nutrition" subtitle="Constraints and plans (Supabase)" icon={BookOpen}>
            <div className="flex justify-center sm:justify-start">
              <NutritionAthleteSummaryCard />
            </div>
          </Pro2SectionCard>
          <Pro2SectionCard
            accent="orange"
            title="Load alignment"
            subtitle="Same data line as training — no second engine"
            icon={CalendarDays}
          >
            <p className="text-sm leading-relaxed text-gray-400">
              Daily targets stay consistent with planned and completed sessions (calendar + builder). Use Virya
              for macro context and adaptation; nutrition V1+2 consumes athlete memory and structured outputs, not
              AI sessions generated in parallel.
            </p>
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
                href="/training/vyria"
                variant="ghost"
                className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
              >
                Virya
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
          subtitle="Day timeline + measured/estimated provenance"
          icon={LineChart}
        >
          <p className="text-sm leading-relaxed text-gray-400">
            Day-level operational view that cross-references training, nutrition diary and device streams to estimate
            supporting/inhibiting pathways without replacing measured data.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pro2Link
              href="/bioenergetics"
              variant="secondary"
              className="justify-center border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25"
            >
              Daily report (charts)
            </Pro2Link>
            <Pro2Link
              href="/nutrition/diary"
              variant="secondary"
              className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
            >
              Food diary
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
        <Pro2SectionCard accent="emerald" title="Physiology" subtitle="Physiological profile" icon={BookOpen}>
          <div className="flex justify-center sm:justify-start">
            <PhysiologyProfileStripCard />
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "health" ? (
        <Pro2SectionCard accent="violet" title="Health & Bio" subtitle="Biomarker panels" icon={BookOpen}>
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
              title="Kinematic data"
              body="Read from capture / analysis tables — queued on the Pro 2 lineup. The twin and training remain the operational source until a dedicated endpoint is exposed."
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
              title="CdA and wind context"
              body="Aerodynamic module linked to disciplines and external sensors; no canonical Supabase read at this stage. It stays within the architectural perimeter for future integrations."
            />
          </div>
        </Pro2SectionCard>
      ) : null}
      </section>

      <section id="gen-cross" className="scroll-mt-28">
        <ModuleCrossLinksCard module={module} />
      </section>

      <section id="gen-focus" className="scroll-mt-28 space-y-6">
        <Pro2SectionCard accent="fuchsia" title="Actions" subtitle="One focus per session — compact controls" icon={Sparkles}>
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
