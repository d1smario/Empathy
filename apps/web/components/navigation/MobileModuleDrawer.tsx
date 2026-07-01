"use client";

import Link from "next/link";
import {
  Activity,
  Award,
  Calendar,
  Cpu,
  Grid3X3,
  Heart,
  LayoutDashboard,
  type LucideIcon,
  Move,
  Settings,
  User,
  Users,
  Utensils,
  Wallet,
  Wind,
  X,
} from "lucide-react";
import { getMobileMenuSections, type MobileMenuItem } from "@/core/navigation/mobile-module-registry";
import type { ProductNavIconKey } from "@/core/navigation/module-registry";
import type { AppRole } from "@/lib/app-session";

type MobileModuleDrawerProps = {
  role?: AppRole;
  open: boolean;
  onClose: () => void;
};

const ICONS: Record<ProductNavIconKey, LucideIcon> = {
  chart: LayoutDashboard,
  users: Users,
  user: User,
  heart: Heart,
  activity: Activity,
  calendar: Calendar,
  wallet: Wallet,
  utensils: Utensils,
  pulse: Cpu,
  motion: Move,
  wind: Wind,
  award: Award,
  settings: Settings,
};

function ModuleTile({
  item,
  onClose,
}: {
  item: MobileMenuItem;
  onClose: () => void;
}) {
  const Icon = ICONS[item.icon];

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="group flex min-h-[5.25rem] flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-fuchsia-500/35 hover:bg-white/10"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-600/25 to-orange-500/15 text-white transition group-hover:border-fuchsia-500/40">
        <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
      </span>
      <span className="text-xs font-semibold leading-tight text-gray-200">{item.label}</span>
    </Link>
  );
}

export function MobileModuleDrawer({ role = "private", open, onClose }: MobileModuleDrawerProps) {
  if (!open) return null;
  const sections = getMobileMenuSections(role);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Modules menu">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(92vh,40rem)] flex-col rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-purple-950/50">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">Empathy Modules</p>
            <p className="truncate text-[0.65rem] text-gray-500">All sections in one place</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
          {sections.map((section) => (
            <section key={section.key} className="mb-5 last:mb-2">
              <p className="mb-2 px-1 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-gray-500">
                {section.title}
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {section.items.map((item) => (
                  <li key={item.key}>
                    <ModuleTile item={item} onClose={onClose} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-5">
          <p className="flex items-center gap-2 text-[0.65rem] text-gray-500">
            <Grid3X3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Builder, VIRYA and the advanced staging lab remain on the desktop version.
          </p>
        </div>
      </div>
    </div>
  );
}
