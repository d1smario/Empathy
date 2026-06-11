"use client";

import { useEffect } from "react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { isMobileBrowserClient } from "@/lib/shell/mobile-detect";
import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";

/**
 * Se la sessione Supabase esiste già nel browser ma la RSC non l'ha vista (timing/cookie),
 * evita di mostrare di nuovo il form magic link.
 *
 * Usa `location.assign` (non `router.replace`) così i cookie di sessione sono inclusi
 * nella richiesta successiva — stesso motivo di `AccessPasswordForm`.
 */
export function AccessRedirectIfSession({ nextPath }: { nextPath: string }) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) return;

      let appRole: PendingAppRole = "private";
      let isPlatformAdmin = false;
      let hasAthleteAccess = false;
      let hasOperatorAccess = false;

      try {
        const uid = data.session.user.id;
        const { data: prof } = await supabase
          .from("app_user_profiles")
          .select("role, is_platform_admin")
          .eq("user_id", uid)
          .maybeSingle();
        const p = prof as { role?: string; is_platform_admin?: boolean } | null;
        if (p?.role === "coach") {
          appRole = "coach";
        }
        if (p?.is_platform_admin === true) {
          isPlatformAdmin = true;
        }

        if (!isPlatformAdmin) {
          const entRes = await fetch("/api/billing/entitlement?repair=1", { cache: "no-store" });
          const ent = (await entRes.json()) as {
            ok?: boolean;
            hasAthleteAccess?: boolean;
            hasOperatorAccess?: boolean;
          };
          if (entRes.ok && ent.ok) {
            hasAthleteAccess = Boolean(ent.hasAthleteAccess);
            hasOperatorAccess = Boolean(ent.hasOperatorAccess);
          }
        }
      } catch {
        /* entitlement / profilo: il gate server sulla shell applicherà il paywall */
      }

      if (cancelled) return;

      const dest = resolvePostLoginDestination({
        next: nextPath,
        appRole,
        hasAthleteAccess,
        hasOperatorAccess,
        isPlatformAdmin,
        preferMobile: isMobileBrowserClient(),
      });
      window.location.assign(dest);
    })();
    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  return null;
}
