"use client";

import Link from "next/link";
import { scopedShellHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";

const BASE =
  "rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-fuchsia-100";

/**
 * CTA "Apri review" di una staging Health: risolve l'href nello scope corrente
 * (atleta → /health/staging/<runId>; coach → /athletes/<id>/...; admin →
 * /admin/utenti/<userId>/...). Inerte SOLO quando lo scope non è ricostruibile.
 * Legge lo scope da useActiveAthlete (niente prop-drilling): stesso pattern di
 * AeroStagingLink. Usato da HealthSystemMapPanel e HealthArchiveSection.
 */
export function HealthStagingReviewLink({ runId }: { runId: string }) {
  const { athleteId, adminScoped, platformAdminView, scopeOwnerUserId } = useActiveAthlete();
  const href = scopedShellHref(`/health/staging/${runId}`, { athleteId, adminScoped, platformAdminView, scopeOwnerUserId });
  if (!href) {
    return (
      <span title="Disponibile nella scheda dedicata (v2)" className={`${BASE} cursor-default opacity-50 transition`}>
        Apri review
      </span>
    );
  }
  return (
    <Link href={href} className={`${BASE} transition-colors hover:border-fuchsia-400/50 hover:bg-fuchsia-500/20`}>
      Apri review
    </Link>
  );
}
