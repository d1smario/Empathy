import { notFound } from "next/navigation";
import { AdminUserContextBar } from "@/components/admin/AdminUserContextBar";
import { getAdminSelectedUser } from "@/lib/admin/selected-user";

export const dynamic = "force-dynamic";

/**
 * Layout dell'utente selezionato: barra contestuale unica (identità + tab
 * Panoramica/8 schede + ✕ chiudi selezione) sopra OGNI rotta
 * /admin/utenti/[id]/... — la sidebar resta solo gestione azienda.
 */
export default async function AdminSelectedUserLayout({
  params,
  children,
}: {
  params: { userId: string };
  children: React.ReactNode;
}) {
  const user = await getAdminSelectedUser(params.userId);
  if (!user) notFound();

  return (
    <div className="min-h-full">
      <AdminUserContextBar userId={user.userId} email={user.email} />
      {children}
    </div>
  );
}
