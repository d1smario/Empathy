import type { AdminDirectoryUserRow } from "@/lib/admin/user-directory-types";

/**
 * Tipi e helper condivisi della pagina admin Vendite.
 * Schema di riferimento: migration 080 (tabelle `sales`, `products`, `commissions`).
 */

export type SaleStatus = "paid" | "free" | "refunded" | "failed";
export type SaleSource = "stripe" | "manual" | "grant_migration";

export type SaleRow = {
  id: string;
  user_id: string | null;
  athlete_id: string | null;
  product_id: string | null;
  product_code: string | null;
  product_name: string | null;
  addons: unknown;
  amount: number | null;
  currency: string | null;
  source: SaleSource;
  status: SaleStatus;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  coach_user_id: string | null;
  promoter_user_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  subtitle: string | null;
  kind: "base" | "addon";
  price: number;
  currency: string;
  billing_interval: "one_time" | "month" | "year";
  duration_days: number | null;
  commission_coach_amount: number | null;
  commission_coach_currency: string | null;
  is_active: boolean;
  sort_order: number;
};

export type DirectoryEntry = {
  email: string | null;
  role: "private" | "coach" | null;
  athleteId: string | null;
};

/**
 * Carica UNA volta la directory utenti admin (paginata, accumula con hasMore)
 * e restituisce la mappa userId → { email, role, athleteId } da riusare ovunque.
 */
export async function loadAdminDirectoryMap(): Promise<Map<string, DirectoryEntry>> {
  const map = new Map<string, DirectoryEntry>();
  // Cap difensivo 20 pagine (2000 utenti).
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`/api/admin/users/directory?page=${page}&perPage=100`, { cache: "no-store" });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      users?: AdminDirectoryUserRow[];
      hasMore?: boolean;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `directory ${res.status}`);
    }
    for (const u of data.users ?? []) {
      map.set(u.userId, { email: u.email, role: u.role, athleteId: u.athleteId });
    }
    if (!data.hasMore) break;
  }
  return map;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function fmtAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  const value = Number(amount ?? 0);
  const cur = (currency ?? "CHF").trim().toUpperCase() || "CHF";
  try {
    return new Intl.NumberFormat("it-CH", { style: "currency", currency: cur }).format(value);
  } catch {
    return `${value.toFixed(2)} ${cur}`;
  }
}

export const STATUS_LABEL: Record<SaleStatus, string> = {
  paid: "Pagata",
  free: "Gratuita",
  refunded: "Rimborsata",
  failed: "Fallita",
};

export const STATUS_PILL: Record<SaleStatus, string> = {
  paid: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  free: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
  refunded: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  failed: "border-rose-400/40 bg-rose-500/10 text-rose-200",
};

export const SOURCE_LABEL: Record<SaleSource, string> = {
  stripe: "Stripe",
  manual: "Manuale",
  grant_migration: "Migrazione grant",
};
