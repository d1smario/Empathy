"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  Calendar,
  Cpu,
  Heart,
  type LucideIcon,
  Move,
  UserRound,
  Utensils,
  Wind,
  X,
} from "lucide-react";
import { ADMIN_USER_MODULE_NAV, adminUserModuleHref, type AdminNavIconKey } from "@/core/navigation/admin-nav";
import { cn } from "@/lib/cn";

const ICONS: Partial<Record<AdminNavIconKey, LucideIcon>> = {
  heart: Heart,
  activity: Activity,
  calendar: Calendar,
  utensils: Utensils,
  pulse: Cpu,
  motion: Move,
  wind: Wind,
  award: Award,
};

/**
 * Barra contestuale dell'utente selezionato, montata dal layout su TUTTE le
 * rotte /admin/utenti/[id]/...: identità ("Vista admin · email"), tab dei
 * moduli del cliente una accanto all'altra (Panoramica + 8 schede) e ✕ per
 * togliere la selezione. I moduli azienda restano SOLO nella sidebar.
 */
export function AdminUserContextBar({ userId, email }: { userId: string; email: string | null }) {
  const pathname = usePathname() ?? "";
  const base = `/admin/utenti/${userId}`;

  const pills: { key: string; label: string; href: string; icon: LucideIcon }[] = [
    { key: "overview", label: "Panoramica", href: base, icon: UserRound },
    ...ADMIN_USER_MODULE_NAV.map((m) => ({
      key: m.key,
      label: m.label,
      href: adminUserModuleHref(userId, m.key),
      icon: ICONS[m.icon] ?? UserRound,
    })),
  ];

  return (
    <div className="sticky top-0 z-30 border-b border-rose-500/20 bg-[#140a0e]/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 sm:px-6">
        <p className="truncate font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rose-200/90">
          Vista admin · {email ?? userId}
        </p>
        <Link
          href="/admin/utenti"
          title="Togli la selezione"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300 transition hover:border-rose-500/40 hover:text-white"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Chiudi
        </Link>
      </div>
      <nav
        aria-label="Schede utente selezionato"
        className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pills.map((p) => {
          const active = p.key === "overview" ? pathname === base : pathname.startsWith(p.href);
          const Icon = p.icon;
          return (
            <Link
              key={p.key}
              href={p.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-transparent bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-md shadow-rose-500/20"
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-rose-500/40 hover:text-gray-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {p.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
