import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safeAppInternalPath } from "@/core/routing/guards";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";

export const dynamic = "force-dynamic";

function redirectOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost && process.env.NODE_ENV === "production") {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

/**
 * Conferma email (signup) e altri OTP via `token_hash` + `verifyOtp`.
 * È il flusso corretto per i link delle email transazionali Supabase con `@supabase/ssr`
 * (il `/auth/callback` resta per il flusso `code`). Template email → vedi docs interne.
 */
export async function GET(request: NextRequest) {
  const origin = redirectOrigin(request);
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeAppInternalPath(searchParams.get("next"), "/auth/verificata");

  const config = getSupabasePublicConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}/access?error=config`);
  }
  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/access?error=auth`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Route handler: scrittura cookie può fallire in alcuni contesti
        }
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/access?error=auth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
