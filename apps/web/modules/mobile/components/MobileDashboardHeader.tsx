"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Header brandizzato della Dashboard mobile (EMPATHY OS) con accesso al drawer moduli.
 * Stesso comportamento di MobileTopBar (sticky + hamburger → drawer), ma con il logo:
 * il controllo in alto a destra è coerente su TUTTE le schermate. Montato dallo shell
 * (MobileShellWithAdaptiveBackdrop) solo su /m/dashboard.
 */
export function MobileDashboardHeader({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const t = useTranslations("MobileDashboardHeader");
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <img src="/brand/empathy-wordmark-white.svg" alt="Empathy" className="h-5 w-auto" />
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-200 transition hover:border-purple-500/40 hover:bg-white/10"
          aria-label={t("openModulesMenu")}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
