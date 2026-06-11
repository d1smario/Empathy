"use client";

import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { ShellMainFrame } from "@/components/shell/ShellMainFrame";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Telaio dell'area Admin: stesso look della shell coach ma con `AdminSidebar`.
 * Nessun athlete-gate a livello shell (i moduli per-utente gestiranno il proprio scope).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <BrutalistAppBackdrop matrix>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <ShellMainFrame generative={false} athleteGate={false}>
          {children}
        </ShellMainFrame>
      </div>
    </BrutalistAppBackdrop>
  );
}
