"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, FileText, LayoutGrid, Link2, Sparkles } from "lucide-react";
import {
  MODULE_PILL_AMBER,
  MODULE_PILL_CYAN,
  MODULE_PILL_FUCHSIA,
  MODULE_PILL_ROSE,
  MODULE_PILL_SKY,
} from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillAnchorItem, scrollToModuleAnchor } from "@/components/navigation/ModulePillSubnav";

export const GENERATIVE_MODULE_ANCHORS = ["gen-domain", "gen-body", "gen-cross", "biomech-report", "gen-focus"] as const;

const ITEMS: ModulePillAnchorItem[] = [
  {
    key: "domain",
    anchor: "gen-domain",
    label: "Ambito",
    icon: BookOpen,
    style: MODULE_PILL_CYAN,
  },
  {
    key: "body",
    anchor: "gen-body",
    label: "Contenuto",
    icon: LayoutGrid,
    style: MODULE_PILL_FUCHSIA,
  },
  {
    key: "cross",
    anchor: "gen-cross",
    label: "Collegamenti",
    icon: Link2,
    style: MODULE_PILL_SKY,
  },
  {
    key: "report",
    anchor: "biomech-report",
    label: "Report",
    icon: FileText,
    style: MODULE_PILL_ROSE,
  },
  {
    key: "focus",
    anchor: "gen-focus",
    label: "Focus",
    icon: Sparkles,
    style: MODULE_PILL_AMBER,
  },
];

export function generativeModuleNavAnchors(): string[] {
  return [...GENERATIVE_MODULE_ANCHORS];
}

/**
 * Subnav a pill per moduli generativi (profile, health, physiology, …): scroll alle sezioni della pagina.
 */
export function GenerativeModuleSubnav() {
  const [activeAnchor, setActiveAnchor] = useState<string>(GENERATIVE_MODULE_ANCHORS[0]);
  // Solo le pill le cui sezioni esistono davvero nella pagina: evita pill «morte»
  // (es. Collegamenti) su moduli che non montano quella sezione.
  const [presentAnchors, setPresentAnchors] = useState<readonly string[] | null>(null);

  const onSelect = useCallback((anchor: string) => {
    setActiveAnchor(anchor);
    scrollToModuleAnchor(anchor);
  }, []);

  useEffect(() => {
    const present = GENERATIVE_MODULE_ANCHORS.filter((id) => document.getElementById(id));
    setPresentAnchors(present);
    const elements = present
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const pick = entries
          .filter((e) => e.isIntersecting && e.target.id)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = pick[0]?.target.id;
        if (id) setActiveAnchor(id);
      },
      { root: null, rootMargin: "-10% 0px -45% 0px", threshold: [0, 0.15, 0.35, 0.55] },
    );
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const items = useMemo(
    () => (presentAnchors ? ITEMS.filter((item) => presentAnchors.includes(item.anchor)) : ITEMS),
    [presentAnchors],
  );

  return (
    <ModulePillSubnav
      variant="anchor"
      items={items}
      activeAnchor={activeAnchor}
      onSelect={onSelect}
      ariaLabel="Sezioni modulo"
    />
  );
}
