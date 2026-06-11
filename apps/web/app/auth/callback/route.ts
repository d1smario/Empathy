import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safeAppInternalPath } from "@/core/routing/guards";
import { bootstrapAppUserProfile } from "@/lib/auth/bootstrap-app-user-profile";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { PENDING_APP_ROLE_COOKIE, parsePendingAppRole } from "@/lib/auth/pending-role-cookie";
import {
  ensureBillingEntitlementForUser,
  loadBillingEntitlementForAuthUser,
} from "@/lib/billing/ensure-billing-entitlement";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { isMobileClientRequest } from "@/lib/shell/mobile-detect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
 * OAuth / magic link: scambia `code` per sessione e imposta cookie (Supabase SSR).
 */
export async function GET(request: NextRequest) {
  const origin = redirectOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAppInternalPath(searchParams.get("next"), "/dashboard");

  const config = getSupabasePublicConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}/access?error=config`);
  }

  if (!code) {
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
          // Route handler edge cases: cookie write may fail in some contexts
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/access?error=auth`);
  }

  const pendingRaw = cookieStore.get(PENDING_APP_ROLE_COOKIE)?.value;
  const pending = parsePendingAppRole(pendingRaw);
  try {
    cookieStore.set(PENDING_APP_ROLE_COOKIE, "", { path: "/", maxAge: 0 });
  } catch {
    // ignore
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/access?error=auth`);
  }
  if (pending) {
    const meta = user.user_metadata as Record<string, unknown>;
    await bootstrapAppUserProfile(supabase, {
      userId: user.id,
      role: pending,
      email: user.email ?? null,
      firstName: typeof meta?.first_name === "string" ? meta.first_name : null,
      lastName: typeof meta?.last_name === "string" ? meta.last_name : null,
      athleteId: null,
    });
  }

  const admin = createSupabaseAdminClient();
  const db = admin ?? supabase;
  // Routing per identità dal DB (non dal cookie `pending`, che con Strada A è sempre `private`).
  const { data: prof } = await supabase
    .from("app_user_profiles")
    .select("role, is_platform_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = prof as { role?: string; is_platform_admin?: boolean } | null;
  const appRole = profileRow?.role === "coach" ? "coach" : "private";
  const isPlatformAdmin = profileRow?.is_platform_admin === true;

  let entitlement: { hasAthleteAccess: boolean; hasOperatorAccess: boolean } = {
    hasAthleteAccess: false,
    hasOperatorAccess: false,
  };
  if (!isPlatformAdmin) {
    entitlement = await loadBillingEntitlementForAuthUser(user.id);
    if (!entitlement.hasAthleteAccess && !entitlement.hasOperatorAccess) {
      try {
        entitlement = await ensureBillingEntitlementForUser(db, user.id, user.email ?? null, {
          repairFromStripe: true,
        });
      } catch (err) {
        console.warn("[auth/callback] billing repair skipped", err instanceof Error ? err.message : err);
      }
    }
  }

  const dest = resolvePostLoginDestination({
    next,
    appRole,
    hasAthleteAccess: entitlement?.hasAthleteAccess ?? false,
    hasOperatorAccess: entitlement?.hasOperatorAccess ?? false,
    isPlatformAdmin,
    preferMobile: isMobileClientRequest(request),
  });

  return NextResponse.redirect(`${origin}${dest}`);
}
