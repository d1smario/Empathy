import type { Metadata } from "next";
import { AdminUsersDirectoryTable } from "@/components/admin/AdminUsersDirectoryTable";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Utenti · Admin",
  description: "Tabella clienti, stati funnel e anagrafica fatturazione.",
};

/**
 * Pagina Utenti: tabella clienti con filtro funnel (Registrati / In prova / Clienti / Coach)
 * e anagrafica fatturazione per utente selezionato (user_billing_profiles, migration 077).
 * Gli altri strumenti vivono nelle rispettive voci: Coach (convalida+richieste),
 * Abbonamenti (piani+grants); il report confluirà nella Dashboard (ultima a essere costruita).
 */
export default function AdminUtentiPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Utenti · Admin"
      eyebrowClassName="text-rose-400"
      title="Utenti"
      description={
        <span className="text-sm text-gray-400">
          Tutti gli account della piattaforma: filtra per stato (registrato, in prova, cliente), cerca per
          email e apri l&apos;anagrafica di fatturazione.
        </span>
      }
    >
      <AdminUsersDirectoryTable />
    </Pro2ModulePageShell>
  );
}
