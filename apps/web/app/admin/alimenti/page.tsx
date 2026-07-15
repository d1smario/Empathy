import type { Metadata } from "next";
import { AdminEngineConfigSection } from "@/components/admin/foods/AdminEngineConfigSection";
import { AdminFoodsManager } from "@/components/admin/foods/AdminFoodsManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alimenti · Admin",
  description: "Database alimenti USDA: descrizioni, macro, immagini, tag derivati e parametri del motore menù.",
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
          USDA con macro per 100 g, categoria e immagine. Dopo ogni modifica ai valori nutrizionali,
          ricalcola i tag derivati. In fondo, i parametri di tuning della generazione menù.
        </span>
      }
    >
      <AdminFoodsManager />
      <AdminEngineConfigSection />
    </Pro2ModulePageShell>
  );
}
