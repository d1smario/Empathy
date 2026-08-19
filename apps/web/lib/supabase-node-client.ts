import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  readOptionalServiceRoleKey,
  readSupabaseAnonKey,
  readSupabasePublicUrl,
} from "@/lib/supabase-env";
import { noStoreFetch } from "@/lib/supabase/no-store-fetch";

/**
 * Client Supabase per processi Node (script ingest, worker) senza dipendere da `supabase-server` / `server-only`.
 * `global.fetch = noStoreFetch`: usato anche dai route handler solo-GET (via `createServerSupabaseClient`),
 * dove Next 14 metterebbe le GET PostgREST nella Data Cache (vedi lib/supabase/no-store-fetch.ts).
 */
export function createNodeSupabaseServicePreferred(): SupabaseClient {
  const supabaseUrl = readSupabasePublicUrl();
  const serviceRoleKey = readOptionalServiceRoleKey();
  const anonKey = readSupabaseAnonKey();
  const key = serviceRoleKey ?? anonKey;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}
