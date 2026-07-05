"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Activity,
  Award,
  Calendar,
  Cpu,
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
} from "lucide-react";
import { PRODUCT_MODULE_NAV, type ProductModuleNavItem, type ProductNavIconKey } from "@/core/navigation/module-registry";
import { SidebarSessionActions } from "@/components/navigation/SidebarSessionActions";
import type { AppRole } from "@/lib/app-session";
import { useActiveAthlete } from "@/lib/use-active-athlete";

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

function NavLink({ item, labelOverride }: { item: ProductModuleNavItem; labelOverride?: string }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isActive =
    normalized === item.href || (item.href !== "/" && normalized.startsWith(`${item.href}/`));
  const Icon = ICONS[item.icon];
  const label = labelOverride ?? (t.has(item.module) ? t(item.module) : item.label);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "border border-transparent bg-gradient-to-r from-purple-600 to-orange-500 text-white shadow-lg shadow-purple-500/30"
          : "border border-white/10 bg-white/5 text-gray-300 backdrop-blur-sm hover:border-purple-500/40"
      }`}
    >
      {isActive ? (
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-full bg-gradient-to-b from-orange-400 via-pink-400 to-purple-400"
          aria-hidden
        />
      ) : null}
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          isActive
            ? "border-white/20 bg-black/20 text-white"
            : "border-white/10 bg-black/20 text-gray-400 group-hover:text-purple-300"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
      </span>
      <span className="relative truncate">{label}</span>
    </Link>
  );
}

export function ProductSidebar({
  initialRole,
  initialAthleteId,
}: {
  initialRole?: AppRole;
  initialAthleteId?: string | null;
} = {}) {
  const t = useTranslations("Nav");
  const { athleteId: ctxAthleteId, role: ctxRole, loading, athletes } = useActiveAthlete();

  // Finché il contesto atleta si risolve lato client (cold start / reload) usa i
  // valori risolti dal server: la sidebar mostra subito le voci giuste, senza il
  // flash in cui appaiono dopo. A risoluzione avvenuta prevale il context.
  const role = loading ? (initialRole ?? ctxRole) : ctxRole;
  const athleteId = loading ? (initialAthleteId ?? ctxAthleteId) : ctxAthleteId;

  const visibleForRole = (item: ProductModuleNavItem) => !item.roles || item.roles.includes(role);
  const mainItems = PRODUCT_MODULE_NAV.filter((i) => i.area === "main" && visibleForRole(i));
  const accountItems = mainItems.filter((i) => i.scope === "account");
  const athleteItems = mainItems.filter((i) => i.scope === "athlete");
  const footer = PRODUCT_MODULE_NAV.filter((i) => i.area === "footer" && visibleForRole(i));

  /**
   * Gruppo atleta in sidebar SOLO per l'utente privato (sono i suoi moduli).
   * Il coach naviga gli assistiti via /athletes/[id]/... con la barra a tab
   * (stesso pattern admin): in sidebar gli restano solo le voci account.
   */
  const athleteInScope = Boolean(athleteId) && role !== "coach";
  const selectedAthlete = athleteId ? athletes.find((a) => a.id === athleteId) : undefined;
  const selectedAthleteName =
    [selectedAthlete?.first_name, selectedAthlete?.last_name].filter(Boolean).join(" ").trim() || null;

  return (
    <aside className="relative flex w-[16.5rem] shrink-0 flex-col border-r border-white/10 bg-black/40 shadow-[inset_-1px_0_0_rgba(168,85,247,0.12)] backdrop-blur-xl">
      <div className="relative border-b border-white/10 px-4 py-5">
        <Link href="/" className="block" aria-label="Empathy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/empathy-wordmark-white.png" alt="Empathy" className="h-8 w-auto" />
        </Link>
      </div>
      <nav className="relative flex flex-1 flex-col gap-1.5 overflow-y-auto p-3" aria-label={t("ariaModules")}>
        {accountItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            // La /dashboard del coach è la sua home operativa (CoachDashboardView),
            // non il cockpit «Oggi & Domani» dell'atleta: il nome resta Dashboard.
            labelOverride={item.module === "dashboard" && role === "coach" ? t("dashboardCoach") : undefined}
          />
        ))}

        {athleteInScope && athleteItems.length > 0 ? (
          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
            <p className="px-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-gray-500">
              {selectedAthleteName ? `${t("athleteGroup")} · ${selectedAthleteName}` : t("athleteGroup")}
            </p>
            {athleteItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        ) : null}
      </nav>
      <div className="space-y-1.5 border-t border-white/10 bg-black/30 p-3">
        {footer.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        {/* Niente link marketing/demo nella shell di prodotto: solo sessione. */}
        <SidebarSessionActions />
      </div>
    </aside>
  );
}
