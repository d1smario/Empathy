import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScopedAthleteSessionView } from "@/components/athlete-scope/ScopedAthleteSessionView";
import { getAdminSelectedUser } from "@/lib/admin/selected-user";

export const dynamic = "force-dynamic";

type PageProps = { params: { userId: string; module: string; date: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  return { title: `Training · ${params.date} · Utente · Admin` };
}

/**
 * Dettaglio seduta del giorno nello scope dell'utente selezionato (parità con il
 * coach, /athletes/[id]/training/session/[date]). Gate admin e barra contestuale
 * dai layout a monte; qui risolviamo l'athleteId dall'utente e passiamo
 * scopeOwnerUserId così i back-link ricostruiscono gli href admin.
 */
export default async function AdminUserSessionPage({ params }: PageProps) {
  if (params.module !== "training") notFound();
  const user = await getAdminSelectedUser(params.userId);
  if (!user || !user.athleteId) notFound();
  return <ScopedAthleteSessionView athleteId={user.athleteId} scope="admin" scopeOwnerUserId={user.userId} />;
}
