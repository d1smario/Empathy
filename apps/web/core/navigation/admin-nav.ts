/**
 * Navigazione dell'area Admin (separata dalla shell coach `(shell)`).
 * Due gruppi, stesso pattern del coach:
 *  - account: pannelli di gestione piattaforma (sempre visibili).
 *  - user: colonne dell'utente selezionato (Health…Longevity), visibili sotto
 *    `/admin/utenti/[id]/...` — wiring nel passo successivo.
 */

export type AdminNavIconKey =
  // account
  | "dashboard"
  | "users"
  | "coach"
  | "wallet"
  | "products"
  | "sales"
  | "subscription"
  | "mail"
  | "user"
  | "foods"
  | "exercises"
  // user-scoped modules (riuso colonne coach)
  | "heart"
  | "activity"
  | "calendar"
  | "utensils"
  | "pulse"
  | "motion"
  | "wind"
  | "award";

export type AdminNavItem = {
  key: string;
  href: `/admin/${string}`;
  label: string;
  icon: AdminNavIconKey;
};

/** Voci fisse dell'account admin — ordine deciso dal prodotto. */
export const ADMIN_ACCOUNT_NAV: AdminNavItem[] = [
  { key: "dashboard", href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "utenti", href: "/admin/utenti", label: "Utenti", icon: "users" },
  { key: "coach", href: "/admin/coach", label: "Coach", icon: "coach" },
  { key: "commissioni", href: "/admin/commissioni", label: "Commissioni", icon: "wallet" },
  { key: "prodotti", href: "/admin/prodotti", label: "Prodotti", icon: "products" },
  { key: "vendite", href: "/admin/vendite", label: "Vendite", icon: "sales" },
  { key: "abbonamenti", href: "/admin/abbonamenti", label: "Abbonamenti", icon: "subscription" },
  { key: "alimenti", href: "/admin/alimenti", label: "Alimenti", icon: "foods" },
  { key: "esercizi", href: "/admin/esercizi", label: "Esercizi", icon: "exercises" },
  { key: "mail-log", href: "/admin/mail-log", label: "Mail Log", icon: "mail" },
  { key: "profilo", href: "/admin/profilo", label: "Profilo", icon: "user" },
];

// Le colonne dell'utente selezionato (Dashboard + 6 moduli) provengono ora da
// SCOPED_ATHLETE_TABS (core/navigation/module-registry): UNICA fonte condivisa con
// coach e atleta, così i TAB non possono divergere. La AdminUserContextBar le legge
// da lì; qui restano solo le voci account dell'admin (ADMIN_ACCOUNT_NAV).
