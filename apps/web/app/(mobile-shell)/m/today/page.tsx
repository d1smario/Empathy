import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import { TodayPageView } from "@/modules/today/components/TodayPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oggi",
  description: "La tua giornata",
};

function localCalendarDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function MobileTodayPage() {
  const session = await getSessionProfile();
  if (session.role !== "private") {
    redirect("/m/dashboard");
  }
  if (!session.athleteId) {
    redirect("/m/profile");
  }
  const supabase = createSupabaseCookieClient();
  let firstName: string | null = null;
  if (supabase) {
    const { data: profileRow } = await supabase
      .from("athlete_profiles")
      .select("first_name")
      .eq("id", session.athleteId)
      .maybeSingle();
    firstName = typeof profileRow?.first_name === "string" ? profileRow.first_name : null;
  }
  return <TodayPageView athleteId={session.athleteId} date={localCalendarDateString()} firstName={firstName} />;
}
