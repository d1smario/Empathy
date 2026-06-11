import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { ScopedAthleteModuleView } from "@/components/athlete-scope/ScopedAthleteModuleView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { ADMIN_USER_MODULE_NAV } from "@/core/navigation/admin-nav";
import { getAdminSelectedUser } from "@/lib/admin/selected-user";

export const dynamic = "force-dynamic";

type PageProps = { params: { userId: string; module: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const m = ADMIN_USER_MODULE_NAV.find((x) => x.key === params.module);
  return { title: m ? `${m.label} · Utente · Admin` : "Utente · Admin" };
}

/**
 * Scheda modulo dell'utente selezionato: monta la STESSA vista del coach
 * ("fotocopia") nello scope dell'atleta preso dall'URL. Identità e tab vivono
 * nella barra contestuale (layout). L'admin legge e modifica tutto: policy DB
 * `platform_admin_all` (078) + gate API `canAccessAthleteData` (ramo admin).
 */
export default async function AdminSelectedUserModulePage({ params }: PageProps) {
  const moduleItem = ADMIN_USER_MODULE_NAV.find((x) => x.key === params.module);
  if (!moduleItem) notFound();

  const user = await getAdminSelectedUser(params.userId);
  if (!user) notFound();

  // Account senza profilo atleta: niente dati da mostrare in nessun modulo.
  if (!user.athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow={`${moduleItem.label} · Utente`}
        eyebrowClassName="text-rose-400"
        title={moduleItem.label}
        description={
          <span className="text-sm text-gray-400">
            <strong className="text-gray-200">{user.email ?? user.userId}</strong> non ha ancora un profilo
            atleta collegato: nessun dato da mostrare.
          </span>
        }
      >
        <Pro2SectionCard accent="slate" title="Profilo atleta assente" subtitle="Si crea al primo accesso dell'utente" icon={UserRound}>
          <p className="text-sm leading-relaxed text-gray-400">
            Il profilo atleta nasce al primo login dell&apos;utente (bootstrap automatico). Appena esiste, questa
            scheda mostrerà i suoi dati.
          </p>
        </Pro2SectionCard>
      </Pro2ModulePageShell>
    );
  }

  return <ScopedAthleteModuleView module={moduleItem.key} athleteId={user.athleteId} />;
}
