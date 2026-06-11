import type { Metadata } from "next";
import { AdminDashboardView } from "@/components/admin/dashboard/AdminDashboardView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard · Admin",
  description: "Panoramica della piattaforma: utenti, coach, vendite, incassi, accessi e commissioni.",
};

/**
 * Dashboard admin: la home dei numeri della piattaforma. KPI, trend vendite,
 * ultime vendite e ripartizione per prodotto, tutto calcolato client-side con
 * letture Supabase dirette dal browser (DB-first, RLS platform_admin_all).
 */
export default function AdminDashboardPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Dashboard · Admin"
      eyebrowClassName="text-rose-400"
      title="Dashboard"
      description={
        <span className="text-sm text-gray-400">
          Panoramica della piattaforma: utenti, coach, vendite, incassi, accessi attivi e commissioni.
          In fondo, il report di dettaglio.
        </span>
      }
    >
      <AdminDashboardView />
    </Pro2ModulePageShell>
  );
}
