import { redirect } from "next/navigation";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/**
 * Area Admin, separata dalla shell coach `(shell)`.
 * Gate unico a livello layout: solo platform-admin; gli altri vengono rimandati alla loro home.
 * (La porta di login unica instraderà ogni identità verso la propria area — passo successivo.)
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlatformAdminSession();
  if (!session) redirect("/dashboard");
  return <AdminShell>{children}</AdminShell>;
}
