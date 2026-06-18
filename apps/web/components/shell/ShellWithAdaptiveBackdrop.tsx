"use client";

import { usePathname } from "next/navigation";
import { isGenerativePath } from "@/core/navigation/generative-modules";
import { requiresResolvedAthleteForPath } from "@/lib/shell/requires-resolved-athlete-path";
import type { AppRole } from "@/lib/app-session";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { ShellMainFrame } from "@/components/shell/ShellMainFrame";
import { ProductSidebar } from "@/components/navigation/ProductSidebar";
import { MobileAppRecoveryBanner } from "@/components/shell/MobileAppRecoveryBanner";

/**
 * Matrix + orb pieni fuori dai moduli generativi; dentro training/nutrition/… matrix off e area contenuto leggermente velata per focus minimal.
 */
export function ShellWithAdaptiveBackdrop({
  children,
  initialRole,
  initialAthleteId,
}: {
  children: React.ReactNode;
  /** Role/athleteId risolti dal server (SSR): stato iniziale sidebar, niente flash al reload. */
  initialRole?: AppRole;
  initialAthleteId?: string | null;
}) {
  const pathname = usePathname() ?? "/";
  const generative = isGenerativePath(pathname);
  const athleteGate = requiresResolvedAthleteForPath(pathname);

  return (
    <BrutalistAppBackdrop matrix={!generative}>
      <div className="flex min-h-screen">
        <ProductSidebar initialRole={initialRole} initialAthleteId={initialAthleteId} />
        <ShellMainFrame generative={generative} athleteGate={athleteGate}>
          <MobileAppRecoveryBanner />
          {children}
        </ShellMainFrame>
      </div>
    </BrutalistAppBackdrop>
  );
}
