"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash } from "lucide-react";

import {
  MODULE_PILL_CYAN,
  type ModulePillStyle,
} from "@/components/navigation/module-pill-styles";
import {
  ModulePillSubnav,
  type ModulePillAnchorItem,
  scrollToModuleAnchor,
} from "@/components/navigation/ModulePillSubnav";

export interface Pro2StickyAnchorItem {
  id: string;
  label: string;
}

export interface Pro2StickyAnchorSubnavProps {
  items: Pro2StickyAnchorItem[];
  accent?: ModulePillStyle;
}

/**
 * Barra sticky di pill-anchor per le sezioni lunghe di una vista modulo.
 * Riusa `ModulePillSubnav` (variante anchor) + `scrollToModuleAnchor`;
 * IntersectionObserver per la pill attiva; al mount filtra le pill i cui id
 * non esistono nel DOM, così un anchor sbagliato sparisce invece di rompersi.
 */
export function Pro2StickyAnchorSubnav({ items, accent = MODULE_PILL_CYAN }: Pro2StickyAnchorSubnavProps) {
  const [activeAnchor, setActiveAnchor] = useState<string>(items[0]?.id ?? "");
  // Solo le pill le cui sezioni esistono davvero nella pagina: evita pill «morte».
  const [presentIds, setPresentIds] = useState<readonly string[] | null>(null);

  const idsKey = useMemo(() => items.map((item) => item.id).join("|"), [items]);

  const onSelect = useCallback((anchor: string) => {
    setActiveAnchor(anchor);
    scrollToModuleAnchor(anchor);
  }, []);

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    const present = ids.filter((id) => document.getElementById(id));
    setPresentIds(present);
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
  }, [idsKey]);

  const pillItems = useMemo<ModulePillAnchorItem[]>(() => {
    const base = items.map((item) => ({
      key: item.id,
      anchor: item.id,
      label: item.label,
      icon: Hash,
      style: accent,
    }));
    return presentIds ? base.filter((item) => presentIds.includes(item.anchor)) : base;
  }, [items, accent, presentIds]);

  if (pillItems.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 -mx-1 border-b border-white/10 bg-slate-950/90 px-1 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/80">
      <ModulePillSubnav
        variant="anchor"
        items={pillItems}
        activeAnchor={activeAnchor}
        onSelect={onSelect}
        ariaLabel="Sezioni pagina"
      />
    </div>
  );
}
