"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/app-session";
import { isGenerativePath } from "@/core/navigation/generative-modules";
import { getProductNavItemByModule } from "@/core/navigation/module-registry";
import { getMobileBottomNav, getMobileMenuItemForPath } from "@/core/navigation/mobile-module-registry";
import { requiresResolvedAthleteForPath } from "@/lib/shell/requires-resolved-athlete-path";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { ShellMainFrame } from "@/components/shell/ShellMainFrame";
import { MobileTopBar } from "@/components/navigation/MobileTopBar";
import { ProductBottomNav } from "@/components/navigation/ProductBottomNav";
import { MobileModuleDrawer } from "@/components/navigation/MobileModuleDrawer";
import { MobileInstallPrompt } from "@/components/shell/MobileInstallPrompt";
import { MobileDashboardHeader } from "@/modules/mobile/components/MobileDashboardHeader";

function mobileTitleForPath(pathname: string, role: AppRole): string {
  const item = getMobileBottomNav(role).find((nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`));
  if (item && item.action !== "open-menu") {
    const navMeta = getProductNavItemByModule(item.module);
    return navMeta?.label ?? item.label;
  }
  const menuItem = getMobileMenuItemForPath(pathname);
  if (menuItem) return menuItem.label;
  if (pathname.startsWith("/m/nutrition/diary")) return "Diario";
  if (pathname.startsWith("/m/training/session")) return "Giornata";
  return "Empathy";
}

/** Shell app mobile: top bar + bottom nav; desktop `(shell)` resta invariato. */
export function MobileShellWithAdaptiveBackdrop({
  children,
  initialRole,
}: {
  children: React.ReactNode;
  /** Role risolto lato server: evita il flash della nav atleta prima dell'idratazione. */
  initialRole?: AppRole;
}) {
  const pathname = usePathname() ?? "/m/dashboard";
  const { role: ctxRole } = useActiveAthlete();
  const role: AppRole = initialRole ?? ctxRole;
  const generative = isGenerativePath(pathname);
  const athleteGate = requiresResolvedAthleteForPath(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = useMemo(() => mobileTitleForPath(pathname, role), [pathname, role]);
  // La dashboard usa l'header brandizzato (EMPATHY OS), le altre schermate la top bar
  // generica: in ENTRAMBE il controllo in alto a destra è l'hamburger che apre il drawer.
  const isDashboard = pathname === "/m/dashboard" || pathname.startsWith("/m/dashboard/");

  return (
    <BrutalistAppBackdrop matrix={false}>
      <div className="flex min-h-screen flex-col">
        {isDashboard ? (
          <MobileDashboardHeader onOpenDrawer={() => setDrawerOpen(true)} />
        ) : (
          <MobileTopBar title={title} onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        <ShellMainFrame
          generative={generative}
          athleteGate={athleteGate}
          className="min-w-0 flex-1 scroll-mt-0 outline-none pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
        >
          <MobileInstallPrompt />
          {children}
        </ShellMainFrame>
        <ProductBottomNav role={role} onOpenModuleMenu={() => setDrawerOpen(true)} moduleMenuOpen={drawerOpen} />
        <MobileModuleDrawer role={role} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </BrutalistAppBackdrop>
  );
}
