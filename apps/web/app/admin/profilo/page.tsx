import type { Metadata } from "next";
import { AdminProfileView } from "@/components/admin/profile/AdminProfileView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profilo · Admin",
  description: "Account dell'operatore piattaforma: dati di accesso, password e sessione.",
};

/**
 * Profilo dell'account admin loggato: dati account, cambio password e uscita.
 * L'admin è un operatore: niente anagrafica fatturazione né dati atleta.
 */
export default function AdminProfiloPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Profilo · Admin"
      eyebrowClassName="text-rose-400"
      title="Profilo"
      description={
        <span className="text-sm text-gray-400">
          Il tuo account operatore della piattaforma: dati di accesso, cambio password e chiusura della
          sessione.
        </span>
      }
    >
      <AdminProfileView />
    </Pro2ModulePageShell>
  );
}
