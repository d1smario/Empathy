import type { ProductModuleId } from "@empathy/contracts";
import type { AppRole } from "@/lib/app-session";

/** Lucide icon names used by the product shell (see ProductSidebar). */
export type ProductNavIconKey =
  | "chart"
  | "users"
  | "user"
  | "heart"
  | "activity"
  | "calendar"
  | "wallet"
  | "utensils"
  | "pulse"
  | "motion"
  | "wind"
  | "award"
  | "settings";

export type ProductModuleNavArea = "main" | "footer";

/**
 * `account` = voci fisse dell'account dell'operatore (sempre visibili per ruolo).
 * `athlete` = colonne dell'atleta in scope (visibili solo quando un atleta è selezionato).
 */
export type ProductModuleNavScope = "account" | "athlete";

export type ProductModuleNavItem = {
  module: ProductModuleId;
  href: `/${string}`;
  label: string;
  icon: ProductNavIconKey;
  /** Main rail vs footer (settings). */
  area: ProductModuleNavArea;
  /** Gruppo: voce account-fissa vs colonna dell'atleta selezionato. */
  scope: ProductModuleNavScope;
  /** Se presente, la voce è visibile solo per questi ruoli (assente = tutti). */
  roles?: AppRole[];
};

/**
 * Single source of truth for product URLs + labels.
 * Ordine: prima le voci fisse dell'account (Dashboard, Calendario, Atleti, Commissioni, Profilo),
 * poi le colonne dell'atleta selezionato (Health → Longevity), infine il footer.
 */
export const PRODUCT_MODULE_NAV: ProductModuleNavItem[] = [
  // — Account-fixed (riferite all'operatore loggato) —
  { module: "dashboard", href: "/dashboard", label: "Dashboard", icon: "chart", area: "main", scope: "account" },
  { module: "calendario", href: "/calendario", label: "Calendario", icon: "calendar", area: "main", scope: "account", roles: ["coach"] },
  { module: "athletes", href: "/athletes", label: "Atleti", icon: "users", area: "main", scope: "account", roles: ["coach"] },
  { module: "commissioni", href: "/commissioni", label: "Commissioni", icon: "wallet", area: "main", scope: "account", roles: ["coach"] },
  { module: "profile", href: "/profile", label: "Profilo", icon: "user", area: "main", scope: "account" },
  // — Athlete-scoped (colonne dell'atleta selezionato) —
  { module: "health", href: "/health", label: "Health & Bio", icon: "heart", area: "main", scope: "athlete" },
  { module: "physiology", href: "/physiology", label: "Physiology", icon: "activity", area: "main", scope: "athlete" },
  { module: "training", href: "/training", label: "Training", icon: "calendar", area: "main", scope: "athlete" },
  { module: "nutrition", href: "/nutrition", label: "Nutrition", icon: "utensils", area: "main", scope: "athlete" },
  { module: "biomechanics", href: "/biomechanics", label: "Biomechanics", icon: "motion", area: "main", scope: "athlete" },
  { module: "aerodynamics", href: "/aerodynamics", label: "Aerodynamics", icon: "wind", area: "main", scope: "athlete" },
  // Bioenergetica (box "Striscia 24 h") assorbita nella Dashboard: nessuna voce nav dedicata (/bioenergetics → /dashboard).
  // Longevity & Fitness assorbito nella Dashboard: nessuna voce nav dedicata (/longevity → /dashboard).
  // Impostazioni consolidate nel Profilo: nessuna voce nav dedicata (/settings → /profile).
];

const byHref = new Map<string, ProductModuleNavItem>(
  PRODUCT_MODULE_NAV.map((item) => [item.href, item]),
);

const byModule = new Map<ProductModuleId, ProductModuleNavItem>(
  PRODUCT_MODULE_NAV.map((item) => [item.module, item]),
);

export function getProductNavItemByHref(pathname: string): ProductModuleNavItem | undefined {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return byHref.get(normalized);
}

export function getProductNavItemByModule(module: ProductModuleId): ProductModuleNavItem | undefined {
  return byModule.get(module);
}

export function pathSegmentFromHref(href: string): string {
  return href.replace(/^\//, "");
}

/**
 * Schede mostrate quando si guarda un ATLETA specifico (coach in /athletes/[id]/*,
 * admin in /admin/utenti/[id]/*). UNICA fonte di verità → coach, admin e atleta vedono
 * gli STESSI tab: la Dashboard (overview/twin, dove vivono Bioenergetica e Longevity) +
 * i 6 moduli atleta. Le FUNZIONI differiscono per ruolo (showTech, azioni staff), i TAB no.
 * Modificando i moduli atleta in PRODUCT_MODULE_NAV, coach e admin si allineano da soli.
 */
export type ScopedAthleteTab = { module: ProductModuleId; label: string; icon: ProductNavIconKey };

export const SCOPED_ATHLETE_TABS: ScopedAthleteTab[] = [
  { module: "dashboard", label: "Dashboard", icon: "chart" },
  ...PRODUCT_MODULE_NAV.filter((item) => item.scope === "athlete").map((item) => ({
    module: item.module,
    label: item.label,
    icon: item.icon,
  })),
];

export const SCOPED_ATHLETE_TAB_MODULES: ProductModuleId[] = SCOPED_ATHLETE_TABS.map((tab) => tab.module);

export function isScopedAthleteTab(module: string): module is ProductModuleId {
  return SCOPED_ATHLETE_TAB_MODULES.includes(module as ProductModuleId);
}
