import type { Metadata } from "next";
import { AdminEngineConfigSection } from "@/components/admin/foods/AdminEngineConfigSection";
import { AdminFoodsManager } from "@/components/admin/foods/AdminFoodsManager";
import { AdminMenuCatalogSection } from "@/components/admin/foods/AdminMenuCatalogSection";
import { AdminMenuRecipesSection } from "@/components/admin/foods/AdminMenuRecipesSection";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alimenti · Admin",
  description:
    "Database alimenti USDA, catalogo menù curato, immagini, tag derivati e parametri del motore menù.",
};

/**
 * Pannello Alimenti: gestione del database `fdc_food` (descrizione, categoria,
 * valori nutrizionali per 100 g, immagine), ricalcolo dei tag derivati
 * (`fdc_food_tagged`) e tuning dei parametri del motore menù.
 */
export default function AdminAlimentiPage() {
  return (
    <Pro2ModulePageShell
      contentMaxWidthClassName="max-w-none"
      eyebrow="Alimenti · Admin"
      eyebrowClassName="text-rose-400"
      title="Alimenti"
      description={
        <span className="text-sm text-gray-400">
          Il database alimenti del motore menù: <span className="font-mono text-amber-300">8.000+</span> cibi
          USDA con macro per 100 g, categoria e immagine. Sotto, il <span className="text-amber-300">Catalogo menù</span>{" "}
          (~300 cibi approvati che il motore usa davvero), le <span className="text-amber-300">Ricette</span> (combinazioni di alimenti del catalogo) e i parametri di tuning della generazione menù.
          Dopo ogni modifica ai valori nutrizionali, ricalcola i tag derivati.
        </span>
      }
    >
      <AdminFoodsManager />
      <AdminMenuCatalogSection />
      <AdminMenuRecipesSection />
      <AdminEngineConfigSection />
    </Pro2ModulePageShell>
  );
}
