import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";

/** ISO (anche timestamp) → "GG/MM/AAAA", deterministico (no locale, no hydration mismatch). */
function formatValidUntil(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Badge compatto "Piano attivo · {label} · fino al {data}" per l'header della
 * dashboard (sostituisce i bottoni Home/Dashboard). Rende null senza piano attivo.
 */
export function DashboardPlanBadge({ entitlement }: { entitlement: UserAccessEntitlement | null }) {
  if (!entitlement?.hasAthleteAccess) return null;
  const validUntil = formatValidUntil(entitlement.validUntil);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-100">
        <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
        Piano attivo
      </span>
      <span className="font-semibold text-white">{entitlement.label}</span>
      {validUntil ? <span className="text-gray-400">· fino al {validUntil}</span> : null}
    </span>
  );
}
