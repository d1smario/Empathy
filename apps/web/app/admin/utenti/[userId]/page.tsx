import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminUserDetailPanel } from "@/components/admin/AdminUserDetailPanel";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { getAdminSelectedUser } from "@/lib/admin/selected-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Utente · Admin" };

/**
 * Tab "Panoramica" dell'utente selezionato: account, accesso piattaforma e
 * anagrafica fatturazione. Le schede moduli sono le tab nella barra contestuale
 * (layout); la selezione si chiude con la ✕ nella stessa barra.
 */
export default async function AdminSelectedUserPage({ params }: { params: { userId: string } }) {
  const user = await getAdminSelectedUser(params.userId);
  if (!user) notFound();

  return (
    <Pro2ModulePageShell
      eyebrow="Utente · Admin"
      eyebrowClassName="text-rose-400"
      title={user.email ?? "Utente"}
      description={
        <span className="text-sm text-gray-400">
          {user.isPlatformAdmin ? "Platform admin" : user.role === "coach" ? "Coach" : "Utente"} · account,
          accesso e anagrafica. Le schede dati sono le tab qui sopra.
        </span>
      }
    >
      <div className="mx-auto max-w-2xl">
        <AdminUserDetailPanel userId={user.userId} />
      </div>
    </Pro2ModulePageShell>
  );
}
