import type { Metadata } from "next";
import { AdminCommissionsTable } from "@/components/admin/commissions/AdminCommissionsTable";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commissioni · Admin",
  description: "Commissioni maturate, richieste e pagate di coach e promoter.",
};

/**
 * Pannello Commissioni: le commissioni nascono dalle vendite (coach Empathy / promoter)
 * secondo gli importi fissi configurati in Prodotti. Qui l'admin vede maturate, richieste
 * e pagate, e gestisce le richieste di pagamento dei beneficiari.
 */
export default function AdminCommissioniPage() {
  return (
    <Pro2ModulePageShell
      contentMaxWidthClassName="max-w-none"
      eyebrow="Commissioni · Admin"
      eyebrowClassName="text-rose-400"
      title="Commissioni"
      description={
        <span className="text-sm text-gray-400">
          Compensi di coach e promoter generati dalle vendite: maturati, richiesti e pagati. Gli importi
          per prodotto sono configurati in Prodotti.
        </span>
      }
    >
      <AdminCommissionsTable />
    </Pro2ModulePageShell>
  );
}
