import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const dynamic = "force-dynamic";

/**
 * Builder solo per coach/admin (2026-07): l'atleta privato non costruisce le
 * proprie sedute. La pill Builder è già nascosta lato client; qui la difesa
 * server: l'atleta privato riceve 404 sulla route. Il coach ci arriva scoped
 * via /athletes/[id]/training/builder.
 */
export default async function TrainingBuilderLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (session.role !== "coach" && !session.isPlatformAdmin) {
    notFound();
  }
  return <>{children}</>;
}
