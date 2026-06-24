"use client";

import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { AccountNoticeBanner } from "@/components/shell/AccountNoticeBanner";

type ShellMainFrameProps = {
  generative: boolean;
  athleteGate: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Area contenuto condivisa desktop (`ProductSidebar` + main) e mobile (top bar + main).
 */
export function ShellMainFrame({ generative, athleteGate, children, className }: ShellMainFrameProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={
        className ??
        // NB: niente backdrop-blur/filter/transform qui — creerebbe un containing-block
        // per i discendenti `position: fixed` (es. il modale Editor profilo), rendendoli
        // relativi a <main> (alto quanto la pagina) invece che al viewport → l'overlay
        // diventa alto quanto la pagina e non scrolla. La velatura resta via bg-black/50.
        (generative
          ? "min-w-0 flex-1 scroll-mt-0 bg-black/50 outline-none"
          : "min-w-0 flex-1 scroll-mt-0 outline-none")
      }
    >
      <AccountNoticeBanner />
      <Pro2AthleteRequiredGate enabled={athleteGate}>{children}</Pro2AthleteRequiredGate>
    </main>
  );
}
