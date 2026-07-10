"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { scopedShellHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { productHrefForPathname } from "@/lib/shell/use-product-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/**
 * Href del dettaglio seduta (`/training/session/[date]`) consapevole dello scope:
 * - atleta sul proprio calendario → rotta globale (con mapping /m per la shell mobile);
 * - coach/admin in scope atleta → rotta ANNIDATA nello scope
 *   (/athletes/[id]/training/session/[date] o /admin/utenti/[userId]/...), perché la
 *   rotta globale fuori scope perde l'atleta («Nessun atleta attivo»).
 * Nella shell mobile coach (/m/athletes/...) la variante scoped va prefissata con /m.
 */
export function useScopedSessionHref(): (date: string) => string {
  const pathname = usePathname() ?? "/";
  const { athleteId, adminScoped, platformAdminView, scopeOwnerUserId } = useActiveAthlete();
  return useCallback(
    (date: string) => {
      const globalHref = `/training/session/${date}`;
      if (!adminScoped) return productHrefForPathname(globalHref, pathname);
      const scoped = scopedShellHref(globalHref, { athleteId, adminScoped, platformAdminView, scopeOwnerUserId });
      if (!scoped) return globalHref;
      return pathname.startsWith("/m/") ? `/m${scoped}` : scoped;
    },
    [pathname, athleteId, adminScoped, platformAdminView, scopeOwnerUserId],
  );
}
