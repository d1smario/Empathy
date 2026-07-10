import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewDashboardView } from "@/components/dashboard/NewDashboardView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analisi",
  description: "Twin, KPI, trend e predizioni",
};

export default async function AnalysisPage() {
  const session = await getSessionProfile();
  if (session.role !== "private") {
    redirect("/dashboard");
  }
  return (
    <Pro2ModulePageShell
      eyebrow="Human Performance Operating System"
      eyebrowClassName="text-violet-400"
      title="Analisi"
      description={<span className="text-sm text-gray-400">Twin, KPI, trend e predizioni</span>}
    >
      <NewDashboardView />
    </Pro2ModulePageShell>
  );
}
