import { notFound } from "next/navigation";
import { MobileCoachAthleteContextBar } from "@/components/coach/MobileCoachAthleteContextBar";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Layout dell'atleta selezionato dal coach nella shell MOBILE (selezione nell'URL,
 * gemello di (shell)/athletes/[athleteId]/layout.tsx): solo coach, solo SUOI atleti
 * (gate canAccessAthleteData → 404 per gli altri, senza rivelare l'id). Barra
 * contestuale sopra ogni scheda.
 */
export default async function MobileCoachSelectedAthleteLayout({
  params,
  children,
}: {
  params: { athleteId: string };
  children: React.ReactNode;
}) {
  await redirectIfShellRoleNotAllowed(["coach"]);

  const athleteId = params.athleteId.trim();
  if (!athleteId) notFound();

  const supabase = createSupabaseCookieClient();
  const session = await getSessionProfile();
  if (!supabase || !session.userId) notFound();

  const allowed = await canAccessAthleteData(supabase, session.userId, athleteId, null);
  if (!allowed) notFound();

  const { data } = await supabase
    .from("athlete_profiles")
    .select("first_name, last_name, email")
    .eq("id", athleteId)
    .maybeSingle();
  const row = data as { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  if (!row) notFound();

  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  const label = name || row.email || athleteId.slice(0, 8);

  return (
    <div className="min-h-full">
      <MobileCoachAthleteContextBar athleteId={athleteId} label={label} email={row.email ?? null} />
      {children}
    </div>
  );
}
