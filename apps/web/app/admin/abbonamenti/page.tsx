import type { Metadata } from "next";
import { AdminGrantsSection } from "@/components/admin/AdminGrantsSection";
import { AdminSubscriptionsTable } from "@/components/admin/AdminSubscriptionsTable";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abbonamenti · Admin",
  description: "Piani attivi (Silver/Gold), prove e accessi gratuiti concessi.",
};

/**
 * Pannello Abbonamenti: vista unica degli accessi — piani venduti via Stripe
 * (Silver/Gold, attivi e in prova) e accessi gratuiti (grant), con la gestione
 * grants (concedi/revoca) sotto. Sezione grants ex AdminConsoleView.
 */
export default function AdminAbbonamentiPage() {
  return (
    <Pro2ModulePageShell
      contentMaxWidthClassName="max-w-none"
      eyebrow="Abbonamenti · Admin"
      eyebrowClassName="text-rose-400"
      title="Abbonamenti"
      description={
        <span className="text-sm text-gray-400">
          Tutti gli accessi attivi alla piattaforma: piani venduti (Silver, Gold), prove in corso e accessi
          gratuiti concessi.
        </span>
      }
    >
      <div className="space-y-12">
        <AdminSubscriptionsTable />
        <AdminGrantsSection />
      </div>
    </Pro2ModulePageShell>
  );
}
