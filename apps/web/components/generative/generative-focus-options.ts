import type { ProductModuleId } from "@empathy/contracts";
import type { ModeSelectOption } from "@/components/ui/empathy";

export type GenerativeFocusConfig = {
  options: ModeSelectOption[];
  defaultValue: string;
  /** Etichetta azione principale (disabilitata finché non c’è pipeline). */
  primaryCtaLabel: string;
};

/**
 * Hub operativo: query stabili per future pipeline (shell / dashboard possono leggerle).
 */
export function getGenerativeContinueHref(module: ProductModuleId, focus: string): string {
  const q = new URLSearchParams({ genModule: module, genFocus: focus });
  return `/dashboard?${q.toString()}`;
}

export function getGenerativeFocusConfig(module: ProductModuleId): GenerativeFocusConfig {
  switch (module) {
    case "training":
      return {
        options: [
          { value: "session", label: "Session (builder)" },
          { value: "calendar", label: "Calendar" },
          { value: "plan", label: "Plan" },
        ],
        defaultValue: "session",
        primaryCtaLabel: "Continue",
      };
    case "nutrition":
      return {
        options: [
          { value: "day", label: "Energy day" },
          { value: "meal", label: "Meal" },
          { value: "constraints", label: "Constraints" },
        ],
        defaultValue: "day",
        primaryCtaLabel: "Calculate",
      };
    case "bioenergetics":
      return {
        options: [
          { value: "day_report", label: "Day report" },
          { value: "intra_day", label: "Intra-day" },
          { value: "pathways", label: "Pathways" },
        ],
        defaultValue: "day_report",
        primaryCtaLabel: "Generate report",
      };
    case "physiology":
      return {
        options: [
          { value: "snapshot", label: "Snapshot" },
          { value: "metabolic", label: "Metabolic" },
          { value: "lactate", label: "Lactate" },
        ],
        defaultValue: "snapshot",
        primaryCtaLabel: "Update",
      };
    case "health":
      return {
        options: [
          { value: "bio", label: "Bio-layer" },
          { value: "panels", label: "Panels" },
        ],
        defaultValue: "bio",
        primaryCtaLabel: "Synthesize",
      };
    case "biomechanics":
      return {
        options: [
          { value: "session", label: "Session" },
          { value: "library", label: "Movement library" },
        ],
        defaultValue: "session",
        primaryCtaLabel: "Analyze",
      };
    case "aerodynamics":
      return {
        options: [
          { value: "position", label: "Position" },
          { value: "equipment", label: "Equipment" },
        ],
        defaultValue: "position",
        primaryCtaLabel: "Simulate",
      };
    default:
      return {
        options: [{ value: "default", label: "Generative" }],
        defaultValue: "default",
        primaryCtaLabel: "Continue",
      };
  }
}
