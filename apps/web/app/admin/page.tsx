import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Landing admin: si entra dalla Dashboard (KPI piattaforma). */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
