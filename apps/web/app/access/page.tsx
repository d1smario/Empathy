import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AccessPasswordForm } from "@/components/access/AccessPasswordForm";
import { AccessRedirectIfSession } from "@/components/access/AccessRedirectIfSession";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { safeAppInternalPath } from "@/core/routing/guards";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { Pro2Link } from "@/components/ui/empathy";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { EMPATHY_DESKTOP_COOKIE, EMPATHY_MOBILE_COOKIE } from "@/core/navigation/mobile-module-registry";
import { isMobilePreferred } from "@/lib/shell/mobile-detect";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Access",
};

/**
 * Rotta anonima; con Supabase + sessione attiva reindirizza a `next` sicuro.
 * Magic link: interpretazione ingresso → sessione cookie; generativo resta downstream dei moduli.
 */
export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const err = typeof searchParams?.error === "string" ? searchParams.error : null;
  const nextRaw = typeof searchParams?.next === "string" ? searchParams.next : null;
  const safeNext = safeAppInternalPath(nextRaw, "/dashboard");
  const t = await getTranslations("Access");

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
            next: safeNext,
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
      <AccessRedirectIfSession nextPath={safeNext} />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen scroll-mt-0 flex-col items-center justify-center gap-8 px-6 py-16 outline-none"
      >
        <div className="text-center">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-gray-500">{t("eyebrow")}</p>
          <Link
            href="/"
            aria-label="Empathy"
            className="mt-4 inline-block text-2xl font-black tracking-[0.12em] text-white transition-opacity hover:opacity-80 sm:text-3xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/empathy-wordmark-white.png" alt="Empathy" className="h-9 w-auto" />
          </Link>
          <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
        </div>
        {err === "auth" ? (
          <p className="max-w-sm text-center text-sm text-amber-300/90" role="alert">
            {t("errLinkInvalid")}
          </p>
        ) : null}
        {err === "config" ? (
          <p className="max-w-sm text-center text-sm text-amber-300/90" role="alert">
            {t("errSupabaseServer")}
          </p>
        ) : null}
        <AccessPasswordForm redirectAfterLogin={safeNext} />
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Pro2Link href="/" variant="ghost" className="justify-center">
            {t("goToHome")}
          </Pro2Link>
        </div>
      </main>
    </BrutalistAppBackdrop>
  );
}
