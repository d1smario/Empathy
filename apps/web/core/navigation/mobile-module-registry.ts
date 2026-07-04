import type { ProductModuleId } from "@empathy/contracts";
import type { AppRole } from "@/lib/app-session";
import { PRODUCT_MODULE_NAV, type ProductModuleNavItem, type ProductNavIconKey } from "@/core/navigation/module-registry";

/** Prefisso route app mobile — parallelo a `(shell)` desktop, stesso deploy. */
export const MOBILE_APP_PREFIX = "/m";

/** Cookie opt-out: utente preferisce shell desktop su telefono. */
export const EMPATHY_DESKTOP_COOKIE = "empathy_desktop";

/** Cookie opt-in: forza shell mobile (es. recupero da opt-out o link `?app=1`). */
export const EMPATHY_MOBILE_COOKIE = "empathy_mobile";

export type MobileMenuItem = {
  key: string;
  module?: ProductModuleId;
  href: `${typeof MOBILE_APP_PREFIX}/${string}` | `/${string}`;
  label: string;
  icon: ProductNavIconKey;
};

export type MobileMenuSection = {
  key: string;
  title: string;
  items: MobileMenuItem[];
};

/**
 * Modulo → rotta mobile equivalente. SOLO i moduli con una rotta `/m/` reale: il drawer
 * mostra esattamente le voci della sidebar desktop (PRODUCT_MODULE_NAV) con gli href su
 * `/m/`. Calendario/Builder/staging ecc. non hanno (ancora) una home mobile.
 */
const MOBILE_HREF: Partial<Record<ProductModuleId, `${typeof MOBILE_APP_PREFIX}/${string}`>> = {
  dashboard: "/m/dashboard",
  profile: "/m/profile",
  health: "/m/health",
  physiology: "/m/physiology",
  training: "/m/training/calendar",
  nutrition: "/m/nutrition",
  biomechanics: "/m/biomechanics",
  aerodynamics: "/m/aerodynamics",
  athletes: "/m/athletes",
  commissioni: "/m/commissioni",
};

function toMobileMenuItem(item: ProductModuleNavItem): MobileMenuItem {
  return {
    key: item.module,
    module: item.module,
    href: MOBILE_HREF[item.module]!,
    label: item.label,
    icon: item.icon,
  };
}

/** Tutte le voci con rotta mobile (per il lookup del titolo della top bar). */
const ALL_MOBILE_ITEMS: MobileMenuItem[] = PRODUCT_MODULE_NAV.filter(
  (i) => i.area === "main" && MOBILE_HREF[i.module],
).map(toMobileMenuItem);

/**
 * Sezioni del drawer per ruolo, DERIVATE da PRODUCT_MODULE_NAV — la STESSA fonte della
 * sidebar desktop (vedi ProductSidebar): voci ed etichette IDENTICHE al desktop, con gli
 * href su `/m/`. Nessuna voce extra (niente "Versione desktop"). È l'UNICA navigazione
 * mobile (niente bottom nav): si apre dall'hamburger.
 *  - atleta: account (Dashboard, Profilo) + moduli (Health … Aerodynamics).
 *  - coach: account con home mobile reale (Atleti, Commissioni, Profilo); i moduli atleta
 *    vivono nella barra contestuale per-atleta, non nella nav globale (come desktop).
 */
export function getMobileMenuSections(role: AppRole): MobileMenuSection[] {
  const visible = PRODUCT_MODULE_NAV.filter(
    (i) => i.area === "main" && (!i.roles || i.roles.includes(role)) && MOBILE_HREF[i.module],
  );
  if (role === "coach") {
    const account = visible.filter((i) => i.scope === "account" && i.module !== "dashboard");
    return [{ key: "account", title: "Coach", items: account.map(toMobileMenuItem) }];
  }
  const account = visible.filter((i) => i.scope === "account");
  const modules = visible.filter((i) => i.scope === "athlete");
  return [
    { key: "account", title: "Account", items: account.map(toMobileMenuItem) },
    { key: "modules", title: "Moduli", items: modules.map(toMobileMenuItem) },
  ];
}

/** Voce corrispondente al path mobile (per il titolo della top bar). */
export function getMobileMenuItemForPath(pathname: string): MobileMenuItem | undefined {
  const n = normalizePathname(pathname);
  for (const item of ALL_MOBILE_ITEMS) {
    if (n === item.href || n.startsWith(`${item.href}/`)) return item;
    if (item.module === "training" && n.startsWith("/m/training")) return item;
    if (item.module === "nutrition" && n.startsWith("/m/nutrition")) return item;
    if (item.module === "athletes" && n.startsWith("/m/athletes")) return item;
  }
  return undefined;
}

function normalizePathname(pathname: string): string {
  const n = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return n || "/";
}

export function isMobileAppPath(pathname: string): boolean {
  const n = normalizePathname(pathname);
  return n === MOBILE_APP_PREFIX || n.startsWith(`${MOBILE_APP_PREFIX}/`);
}

/** Rimuove `/m` per riusare policy path desktop (athlete gate, generative, ecc.). */
export function stripMobileAppPrefix(pathname: string): string {
  const n = normalizePathname(pathname);
  if (n === MOBILE_APP_PREFIX) return "/dashboard";
  if (n.startsWith(`${MOBILE_APP_PREFIX}/`)) {
    const rest = n.slice(MOBILE_APP_PREFIX.length);
    return rest.length ? rest : "/dashboard";
  }
  return n;
}

/**
 * Path desktop → mobile se esiste equivalente.
 * `null` = restare su desktop (builder, coach, moduli non coperti).
 */
export function toMobilePath(pathname: string): string | null {
  const n = normalizePathname(pathname);
  if (isMobileAppPath(n)) return n;

  const directMap: Array<[string, string]> = [
    ["/dashboard", `${MOBILE_APP_PREFIX}/dashboard`],
    ["/profile", `${MOBILE_APP_PREFIX}/profile`],
    ["/settings", `${MOBILE_APP_PREFIX}/settings`],
    ["/health", `${MOBILE_APP_PREFIX}/health`],
    ["/physiology", `${MOBILE_APP_PREFIX}/physiology`],
    ["/bioenergetics", `${MOBILE_APP_PREFIX}/bioenergetics`],
    ["/biomechanics", `${MOBILE_APP_PREFIX}/biomechanics`],
    ["/aerodynamics", `${MOBILE_APP_PREFIX}/aerodynamics`],
    ["/longevity", `${MOBILE_APP_PREFIX}/longevity`],
  ];

  for (const [desktop, mobile] of directMap) {
    if (n === desktop || n.startsWith(`${desktop}/`)) return mobile;
  }

  if (n === "/training/calendar" || n.startsWith("/training/calendar/")) {
    return `${MOBILE_APP_PREFIX}/training/calendar`;
  }
  if (n === "/training/session") return `${MOBILE_APP_PREFIX}/training/session`;
  if (n.startsWith("/training/session/")) {
    return `${MOBILE_APP_PREFIX}${n}`;
  }

  if (n === "/nutrition/meal-plan" || n.startsWith("/nutrition/meal-plan/")) {
    return `${MOBILE_APP_PREFIX}/nutrition/meal-plan`;
  }
  // «Oggi» assorbe fueling + diary (riorganizzazione menù 2026-07).
  if (
    n === "/nutrition" ||
    n === "/nutrition/today" ||
    n.startsWith("/nutrition/today/") ||
    n === "/nutrition/diary" ||
    n.startsWith("/nutrition/diary/") ||
    n === "/nutrition/fueling" ||
    n.startsWith("/nutrition/fueling/")
  ) {
    return `${MOBILE_APP_PREFIX}/nutrition/today`;
  }

  return null;
}

export function toDesktopPath(mobilePathname: string): string {
  const n = normalizePathname(mobilePathname);
  if (!isMobileAppPath(n)) return n;

  const moduleMap: Record<string, string> = {
    [`${MOBILE_APP_PREFIX}/dashboard`]: "/dashboard",
    [`${MOBILE_APP_PREFIX}/profile`]: "/profile",
    [`${MOBILE_APP_PREFIX}/settings`]: "/settings",
    [`${MOBILE_APP_PREFIX}/health`]: "/health",
    [`${MOBILE_APP_PREFIX}/physiology`]: "/physiology",
    [`${MOBILE_APP_PREFIX}/bioenergetics`]: "/bioenergetics",
    [`${MOBILE_APP_PREFIX}/biomechanics`]: "/biomechanics",
    [`${MOBILE_APP_PREFIX}/aerodynamics`]: "/aerodynamics",
    [`${MOBILE_APP_PREFIX}/longevity`]: "/longevity",
    [`${MOBILE_APP_PREFIX}/training/calendar`]: "/training/calendar",
    [`${MOBILE_APP_PREFIX}/training/session`]: "/training/session",
    [`${MOBILE_APP_PREFIX}/nutrition`]: "/nutrition/today",
    [`${MOBILE_APP_PREFIX}/nutrition/today`]: "/nutrition/today",
  };

  if (moduleMap[n]) return moduleMap[n];
  if (n.startsWith(`${MOBILE_APP_PREFIX}/training/session/`)) {
    return n.slice(MOBILE_APP_PREFIX.length);
  }
  if (n === `${MOBILE_APP_PREFIX}/nutrition/meal-plan` || n.startsWith(`${MOBILE_APP_PREFIX}/nutrition/meal-plan/`)) {
    return "/nutrition/meal-plan";
  }

  return "/dashboard";
}

export function isMobileRedirectSourcePath(pathname: string): boolean {
  return toMobilePath(pathname) != null;
}

/** Applica equivalente mobile se esiste (post-login, link interni). */
export function preferMobileAppPath(pathname: string, preferMobile: boolean): string {
  if (!preferMobile) return pathname;

  const [baseRaw, ...queryParts] = pathname.split("?");
  const base = normalizePathname(baseRaw ?? "/");
  const query = queryParts.length ? `?${queryParts.join("?")}` : "";
  const mobile = toMobilePath(base);
  return mobile ? `${mobile}${query}` : pathname;
}
