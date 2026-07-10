// Shim: il bundle del motore legge `process.env` (lazy, dentro createSupabaseAdminClient
// e coachOrgIdForDb). In Deno mappiamo su Deno.env PRIMA di importare il bundle.
// Va importato per primo in index.ts.
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
if (!g.process) {
  g.process = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      // opzionale: senza, coachOrgIdForDb usa il default seed (EMPATHY_DEFAULT_ORG_ID)
      EMPATHY_COACH_ATHLETES_ORG_ID: Deno.env.get("EMPATHY_COACH_ATHLETES_ORG_ID"),
    },
  };
}
export {};
