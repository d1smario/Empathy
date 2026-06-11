"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Wrapper client che mostra `children` solo se `/api/admin/me` ritorna `isAdmin: true`.
 *
 * Lo stato server-side di "platform admin" è deciso SOLO dal DB:
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
    void fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ isAdmin?: boolean }>)
      .then((j) => {
        if (!cancelled) setIsAdmin(j.isAdmin === true);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAdmin !== true) return null;
  return <>{children}</>;
}
