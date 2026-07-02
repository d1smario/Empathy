"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Wrapper client che mostra `children` solo se la propria riga `app_user_profiles`
 * ha `is_platform_admin = true` (lettura diretta dal browser, policy `select_own`).
 *
 * Lo stato "platform admin" è deciso SOLO dal DB:
 * `app_user_profiles.is_platform_admin = true` (modificabile solo via service_role,
 * trigger migration 024) — vedi `lib/platform-admin.ts` → `resolvePlatformAdminAccess`.
 * Quindi nessun cliente finale può vedere queste sezioni "manomettendo" il client.
 *
 * Il rendering è **null** durante il loading (no flash di contenuto admin).
 * Per il pannello "Diagnostica" è il comportamento desiderato.
 */
export function PlatformAdminOnly({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createEmpathyBrowserSupabase();
        if (!supabase) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const { data } = await supabase
          .from("app_user_profiles")
          .select("is_platform_admin")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) {
          setIsAdmin((data as { is_platform_admin?: boolean | null } | null)?.is_platform_admin === true);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAdmin !== true) return null;
  return <>{children}</>;
}
