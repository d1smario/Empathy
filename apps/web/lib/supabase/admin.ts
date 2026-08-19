import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { noStoreFetch } from "@/lib/supabase/no-store-fetch";

/**
 * Client service role (solo route server). Bypass RLS: usare solo dopo aver verificato l’utente (cookie).
 * `null` se manca `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * `global.fetch = noStoreFetch`: i cron (route handler solo-GET) usano QUESTO client, e senza
 * `cache: "no-store"` Next 14 serviva le GET PostgREST dalla Data Cache tra un'invocazione e
 * l'altra (sedute reali invisibili al motore nutrizione — vedi no-store-fetch.ts).
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}
