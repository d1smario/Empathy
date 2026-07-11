"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  Calendar,
  Cpu,
  CreditCard,
  Dumbbell,
  Heart,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Mail,
  Move,
  Package,
  TrendingUp,
  User,
  UserCog,
  Users,
  Utensils,
  Wallet,
  Wind,
} from "lucide-react";
import { ADMIN_ACCOUNT_NAV, type AdminNavIconKey, type AdminNavItem } from "@/core/navigation/admin-nav";
import { SidebarSessionActions } from "@/components/navigation/SidebarSessionActions";

const ICONS: Record<AdminNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  coach: UserCog,
  wallet: Wallet,
  products: Package,
  sales: TrendingUp,
  subscription: CreditCard,
  mail: Mail,
  user: User,
  foods: Utensils,
  exercises: Dumbbell,
  faq: HelpCircle,
  events: Calendar,
  inbox: Inbox,
  heart: Heart,
  activity: Activity,
  calendar: Calendar,
  utensils: Utensils,
  pulse: Cpu,
  motion: Move,
  wind: Wind,
  award: Award,
};

function AdminNavLink({ item }: { item: AdminNavItem }) {
  const pathname = usePathname();
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isActive = normalized === item.href || normalized.startsWith(`${item.href}/`);
  const Icon = ICONS[item.icon];

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "border border-transparent bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-lg shadow-orange-500/25"
          : "border border-white/10 bg-white/5 text-gray-300 backdrop-blur-sm hover:border-orange-500/40"
      }`}
    >
      {isActive ? (
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-full bg-gradient-to-b from-orange-300 via-rose-400 to-amber-400"
          aria-hidden
        />
      ) : null}
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          isActive
            ? "border-white/20 bg-black/20 text-white"
            : "border-white/10 bg-black/20 text-gray-400 group-hover:text-orange-200"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
      </span>
      <span className="relative truncate">{item.label}</span>
    </Link>
  );
}

export function AdminSidebar() {
  return (
    <aside className="relative flex w-[16.5rem] shrink-0 flex-col border-r border-white/10 bg-black/40 shadow-[inset_-1px_0_0_rgba(244,63,94,0.12)] backdrop-blur-xl">
      <div className="relative border-b border-white/10 px-4 py-5">
        <Link href="/admin" className="flex items-center gap-2.5" aria-label="Empathy Admin">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/empathy-wordmark-white.png" alt="Empathy" className="h-7 w-auto" />
          <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.15em] text-rose-300">
            Admin
          </span>
        </Link>
      </div>
      <nav className="relative flex flex-1 flex-col gap-1.5 overflow-y-auto p-3" aria-label="Pannelli admin">
        {ADMIN_ACCOUNT_NAV.map((item) => (
          <AdminNavLink key={item.href} item={item} />
        ))}
        {/* Le schede dell'utente selezionato vivono nella barra contestuale in alto (AdminUserContextBar). */}
      </nav>
      <div className="space-y-1.5 border-t border-white/10 bg-black/30 p-3">
        <SidebarSessionActions />
      </div>
    </aside>
  );
}
