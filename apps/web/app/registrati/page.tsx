import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AccessRegisterForm } from "@/components/access/AccessRegisterForm";
import { AccessRedirectIfSession } from "@/components/access/AccessRedirectIfSession";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { EMPATHY_DESKTOP_COOKIE, EMPATHY_MOBILE_COOKIE } from "@/core/navigation/mobile-module-registry";
import { isMobilePreferred } from "@/lib/shell/mobile-detect";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registrati — Empathy",
  description: "Crea il tuo account Empathy.",
};

/**
 * Pagina di REGISTRAZIONE (porta unica, separata dal login `/access`).
 * Se già loggato, instrada per identità come `/access`.
 */
export default async function RegisterPage() {
  if (getSupabasePublicConfig()) {
    const sb = createSupabaseCookieClient();
    if (sb) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) {
        const admin = createSupabaseAdminClient();
        const { data: prof } = await sb
          .from("app_user_profiles")
          .select("role, is_platform_admin")
          .eq("user_id", user.id)
          .maybeSingle();
        const profileRow = prof as { role?: string; is_platform_admin?: boolean } | null;
        const appRole = profileRow?.role === "coach" ? "coach" : "private";
        const isPlatformAdmin = profileRow?.is_platform_admin === true;
        const ent = isPlatformAdmin
          ? { hasAthleteAccess: false, hasOperatorAccess: false }
          : await loadUserAccessEntitlement(admin ?? sb, user.id);
        const hdrs = headers();
        const cookieStore = cookies();
        const preferMobile = isMobilePreferred({
          desktopCookie: cookieStore.get(EMPATHY_DESKTOP_COOKIE)?.value,
          mobileCookie: cookieStore.get(EMPATHY_MOBILE_COOKIE)?.value,
          userAgent: hdrs.get("user-agent"),
          secChUaMobile: hdrs.get("sec-ch-ua-mobile"),
        });
        redirect(
          resolvePostLoginDestination({
            next: "/dashboard",
            appRole,
            hasAthleteAccess: ent.hasAthleteAccess,
            hasOperatorAccess: ent.hasOperatorAccess,
            isPlatformAdmin,
            preferMobile,
          }),
        );
      }
    }
  }

  return (
    <BrutalistAppBackdrop matrix>
      <AccessRedirectIfSession nextPath="/dashboard" />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen scroll-mt-0 flex-col items-center justify-center gap-8 px-6 py-16 outline-none"
      >
        <div className="text-center">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-gray-500">REGISTRATI</p>
          <Link
            href="/"
            className="mt-4 inline-block text-2xl font-black tracking-[0.12em] text-white transition-opacity hover:opacity-80 sm:text-3xl"
          >
            EMPATHY
          </Link>
          <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
        </div>
        <AccessRegisterForm />
        <Link href="/" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
          ← Torna alla home
        </Link>
      </main>
    </BrutalistAppBackdrop>
  );
}
