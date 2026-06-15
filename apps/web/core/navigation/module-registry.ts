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
  { module: "bioenergetics", href: "/bioenergetics", label: "BioEnergetic Intelligence", icon: "pulse", area: "main", scope: "athlete" },
  { module: "longevity", href: "/longevity", label: "Longevity & Fitness", icon: "award", area: "main", scope: "athlete" },
  // — Footer (solo account privato; rimosso dalla vista coach) —
  { module: "settings", href: "/settings", label: "Impostazioni", icon: "settings", area: "footer", scope: "account", roles: ["private"] },
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
