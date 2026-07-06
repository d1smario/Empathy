import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function readSupabasePublicEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export type SupabaseSessionMiddlewareResult = {
  response: NextResponse;
  user: User | null;
  supabaseConfigured: boolean;
};

/**
 * Propaga i cookie Set-Cookie dalla risposta sessione alla risposta finale (es. redirect).
 */
export function forwardMiddlewareCookies(from: NextResponse, to: NextResponse): void {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value);
  }
}

/**
 * Edge-safe: nessun `server-only`. Aggiorna i cookie di sessione Supabase su ogni richiesta.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * `verifyUser=false` (default per i path che non consultano l'utente — marketing,
 * `/access`, `/api/*`, ecc.): si salta la chiamata di validazione `getUser()`
 * (un round-trip di rete a `/auth/v1/user` su OGNI richiesta) e si lascia solo
 * passare i cookie. Il middleware consulta `user` solo su path protetti / sorgenti
 * di redirect mobile, dove passiamo `verifyUser=true` e la sicurezza resta intatta.
 */
export async function updateSupabaseSession(
  request: NextRequest,
  opts?: { verifyUser?: boolean },
): Promise<SupabaseSessionMiddlewareResult> {
  const env = readSupabasePublicEnv();
  if (!env) {
    return { response: NextResponse.next({ request }), user: null, supabaseConfigured: false };
  }

  if (opts?.verifyUser === false) {
    // Nessun redirect dipende da `user` su questi path: niente getUser (0 round-trip).
    return { response: NextResponse.next({ request }), user: null, supabaseConfigured: true };
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user, supabaseConfigured: true };
}
