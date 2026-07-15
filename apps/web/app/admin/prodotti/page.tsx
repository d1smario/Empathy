import type { Metadata } from "next";
import { AdminProductsManager } from "@/components/admin/products/AdminProductsManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prodotti · Admin",
  description: "Catalogo vendibile: piani base, add-on, prezzi, durata e commissioni.",
};

/**
 * Pannello Prodotti: gestione del catalogo vendibile, parametrico da DB
 * (tabella `products`) — lista, creazione, modifica e attiva/disattiva rapido.
 */
export default function AdminProdottiPage() {
  return (
    <Pro2ModulePageShell
      contentMaxWidthClassName="max-w-none"
      eyebrow="Prodotti · Admin"
      eyebrowClassName="text-rose-400"
      title="Prodotti"
      description={
        <span className="text-sm text-gray-400">
          Il catalogo di ciò che Empathy vende: piani base e add-on con prezzo, intervallo di fatturazione,
          inclusioni coach e commissioni fisse. Tutto parametrico da database.
        </span>
      }
    >
      <AdminProductsManager />
    </Pro2ModulePageShell>
  );
}
