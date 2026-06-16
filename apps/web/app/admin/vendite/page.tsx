import type { Metadata } from "next";
import { AdminSalesView } from "@/components/admin/sales/AdminSalesView";
import { AdminPromoCodesManager } from "@/components/admin/promo-codes/AdminPromoCodesManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vendite · Admin",
  description: "Fonte unica delle vendite: Stripe, manuali e migrazioni grant.",
};

/**
 * Pannello Vendite: fonte unica delle vendite (tabella `sales`) — checkout Stripe,
 * vendite manuali e migrazioni grant, con contatori, filtri e creazione manuale.
 */
export default function AdminVenditePage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Vendite · Admin"
      eyebrowClassName="text-rose-400"
      title="Vendite"
      description={
        <span className="text-sm text-gray-400">
          Tutte le vendite della piattaforma: incassi Stripe, vendite manuali e migrazioni, con commissioni e
          attivazione accesso.
        </span>
      }
    >
      <AdminSalesView />

      {/* Codici promo: sezione DENTRO Vendite (sconto o sblocco prodotto nascosto). */}
      <div className="mt-12 border-t border-white/10 pt-10">
        <AdminPromoCodesManager />
      </div>
    </Pro2ModulePageShell>
  );
}
