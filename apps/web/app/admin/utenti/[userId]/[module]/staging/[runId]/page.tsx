import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteStagingView } from "@/components/athlete-scope/ScopedAthleteStagingView";
import { getAdminSelectedUser } from "@/lib/admin/selected-user";

export const dynamic = "force-dynamic";

/** Moduli con flusso staging/review (proposta da validare). */
const STAGING_MODULES = ["health", "biomechanics", "aerodynamics"];

type PageProps = { params: { userId: string; module: string; runId: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  return { title: `Review · ${params.module} · Utente · Admin` };
}

/**
 * Review/validazione di una proposta nello scope dell'utente selezionato (parità con il
 * coach, che ha /athletes/[id]/[module]/staging/[runId]). Gate admin
 * (requirePlatformAdminSession) e barra contestuale arrivano dai layout app/admin/layout.tsx
 * e [userId]/layout.tsx; qui risolviamo l'athleteId dall'utente e montiamo la staging view
 * nello scope, passando scopeOwnerUserId così back-link e CTA ricostruiscono gli href admin
 * (le rotte admin sono chiavate su userId, non athleteId).
 */
export default async function AdminUserStagingPage({ params }: PageProps) {
  if (!STAGING_MODULES.includes(params.module)) notFound();
  const user = await getAdminSelectedUser(params.userId);
  if (!user || !user.athleteId) notFound();
  return (
    <ScopedAthleteStagingView
      module={params.module}
      athleteId={user.athleteId}
      runId={params.runId}
      scope="admin"
      scopeOwnerUserId={user.userId}
    />
  );
}
