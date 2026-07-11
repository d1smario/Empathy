import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import { loadOnboardingCompleteness } from "@/lib/onboarding/load-onboarding-snapshot";
import { OnboardingPageView } from "@/modules/onboarding/OnboardingPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prepara il tuo piano",
  description: "Completa i dati per generare il tuo piano",
};

export default async function OnboardingPage() {
  const session = await getSessionProfile();
  // Sala d'attesa: vista dell'atleta sul proprio onboarding.
  if (session.role !== "private") {
    redirect("/dashboard");
  }
  if (!session.athleteId) {
    redirect("/profile");
  }
  const supabase = createSupabaseCookieClient();
  if (!supabase) {
    redirect("/profile");
  }
  const [{ data: profileRow }, completeness] = await Promise.all([
    supabase.from("athlete_profiles").select("first_name").eq("id", session.athleteId).maybeSingle(),
    loadOnboardingCompleteness(supabase, session.athleteId),
  ]);
  const firstName = typeof profileRow?.first_name === "string" ? profileRow.first_name : null;

  return <OnboardingPageView athleteId={session.athleteId} firstName={firstName} completeness={completeness} />;
}
