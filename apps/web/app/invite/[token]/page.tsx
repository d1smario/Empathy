import type { Metadata } from "next";
import { InviteTokenClient, type InviteInitialStatus } from "./InviteTokenClient";
import { resolveCoachDisplayName } from "@/lib/auth/accept-coach-invite-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invito coach",
};

export default async function InvitePage({ params }: { params: { token: string } }) {
  const token = (params.token ?? "").trim();
  let initialStatus: InviteInitialStatus = "not_found";

  let coachName: string | null = null;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    initialStatus = "misconfigured";
  } else if (!token) {
    initialStatus = "not_found";
  } else {
    const { data, error } = await admin
      .from("coach_invitations")
      .select("inviting_coach_user_id, expires_at, consumed_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) {
      initialStatus = "not_found";
    } else {
      const row = data as { inviting_coach_user_id: string; expires_at: string; consumed_at: string | null };
      if (row.consumed_at) initialStatus = "consumed";
      else if (new Date(row.expires_at) <= new Date()) initialStatus = "expired";
      else initialStatus = "valid";
      coachName = await resolveCoachDisplayName(admin, row.inviting_coach_user_id);
    }
  }

  return <InviteTokenClient token={token} initialStatus={initialStatus} coachName={coachName} />;
}
