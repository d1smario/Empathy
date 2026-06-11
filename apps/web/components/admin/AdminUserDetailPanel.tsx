"use client";

import { useEffect, useState } from "react";
import type { AdminUserAnagraficaRow } from "@/lib/admin/user-directory-types";

const COPY = {
  loading: "Caricamento dettaglio…",
  unavailable: "Dettaglio non disponibile.",
  account: "Account",
  access: "Accesso piattaforma",
  anagrafica: "Anagrafica · fatturazione",
  anagraficaEmpty:
    "Anagrafica non compilata: l'utente non ha ancora inserito i dati di fatturazione (indirizzo richiesto per fatture/ricevute CH).",
} as const;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

export type AdminUserDetail = {
  ok: boolean;
  error?: string;
  user?: { id: string; email: string | null; createdAt: string | null; lastSignInAt: string | null };
  profile?: {
    role: "private" | "coach" | null;
    platformCoachStatus: string | null;
    isPlatformAdmin: boolean;
    athleteId: string | null;
  };
  entitlement?: { label: string; source: string; validUntil: string | null; hasAthleteAccess: boolean };
  stripeSubscriptions?: { status: string; basePlanId: string | null; currentPeriodEnd: string | null }[];
  grants?: { id: string; kind: string; ends_at: string; revoked_at: string | null }[];
  anagrafica?: AdminUserAnagraficaRow | null;
};

/**
 * Card Account + Accesso + Anagrafica per un utente (fonte: API admin detail).
 * Usato dal pannello laterale della tabella Utenti e dalla pagina overview
 * dell'utente selezionato (/admin/utenti/[id]).
 */
export function AdminUserDetailPanel({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/detail`, { cache: "no-store" });
        const data = (await res.json()) as AdminUserDetail;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail({ ok: false, error: COPY.unavailable });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-gray-500">{COPY.loading}</div>;
  }

  if (!detail || !detail.ok) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-red-400" role="alert">
        {detail?.error ?? COPY.unavailable}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Account */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-zinc-500">{COPY.account}</h3>
        <p className="mt-2 break-all text-sm font-semibold text-white">{detail.user?.email ?? "—"}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <dt className="text-gray-500">Ruolo</dt>
          <dd>
            {detail.profile?.isPlatformAdmin ? (
              <span className="inline-block rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                Platform admin
              </span>
            ) : detail.profile?.role === "coach" ? (
              <span className="inline-block rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                Coach ({detail.profile.platformCoachStatus ?? "—"})
              </span>
            ) : (
              <span className="inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                Utente
              </span>
            )}
          </dd>
          <dt className="text-gray-500">Registrato</dt>
          <dd className="text-gray-300">{fmtDate(detail.user?.createdAt)}</dd>
          <dt className="text-gray-500">Ultimo accesso</dt>
          <dd className="text-gray-300">{fmtDate(detail.user?.lastSignInAt)}</dd>
          <dt className="text-gray-500">Athlete ID</dt>
          <dd className="break-all font-mono text-[11px] text-zinc-500">{detail.profile?.athleteId ?? "—"}</dd>
        </dl>
      </section>

      {/* Accesso */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-zinc-500">{COPY.access}</h3>
        <p className="mt-2 text-sm text-gray-200">{detail.entitlement?.label ?? "—"}</p>
        {detail.entitlement?.validUntil ? (
          <p className="mt-1 text-xs text-gray-500">Valido fino a {fmtDate(detail.entitlement.validUntil)}</p>
        ) : null}
        {detail.stripeSubscriptions?.length ? (
          <ul className="mt-3 space-y-1.5 text-xs text-gray-400">
            {detail.stripeSubscriptions.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="capitalize">{s.basePlanId ?? "piano"}</span>
                  <span
                    className={
                      s.status === "active"
                        ? "inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
                        : s.status === "trialing"
                          ? "inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                          : "inline-block rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-400"
                    }
                  >
                    {s.status}
                  </span>
                </span>
                <span className="text-gray-600">{fmtDate(s.currentPeriodEnd)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {detail.grants?.length ? (
          <p className="mt-3 text-xs text-gray-500">
            <span className="font-mono tabular-nums text-emerald-300">
              {detail.grants.filter((g) => !g.revoked_at).length}
            </span>{" "}
            grant attivi su <span className="font-mono tabular-nums text-zinc-200">{detail.grants.length}</span>
          </p>
        ) : null}
      </section>

      {/* Anagrafica */}
      <section className="rounded-2xl border border-cyan-400/20 bg-white/[0.03] p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-cyan-300/80">{COPY.anagrafica}</h3>
        {detail.anagrafica ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <dt className="text-gray-500">Nome</dt>
            <dd className="text-gray-200">
              {[detail.anagrafica.firstName, detail.anagrafica.lastName].filter(Boolean).join(" ") || "—"}
            </dd>
            {detail.anagrafica.companyName ? (
              <>
                <dt className="text-gray-500">Azienda</dt>
                <dd className="text-gray-200">{detail.anagrafica.companyName}</dd>
              </>
            ) : null}
            {detail.anagrafica.vatNumber ? (
              <>
                <dt className="text-gray-500">P. IVA / UID</dt>
                <dd className="font-mono text-gray-300">{detail.anagrafica.vatNumber}</dd>
              </>
            ) : null}
            <dt className="text-gray-500">Indirizzo</dt>
            <dd className="text-gray-200">
              {[detail.anagrafica.addressLine1, detail.anagrafica.addressLine2].filter(Boolean).join(", ") || "—"}
            </dd>
            <dt className="text-gray-500">CAP · Città</dt>
            <dd className="text-gray-200">
              {[detail.anagrafica.postalCode, detail.anagrafica.city].filter(Boolean).join(" ") || "—"}
            </dd>
            <dt className="text-gray-500">Regione · Paese</dt>
            <dd className="text-gray-200">
              {[detail.anagrafica.region, detail.anagrafica.countryCode].filter(Boolean).join(" · ") || "—"}
            </dd>
            <dt className="text-gray-500">Telefono</dt>
            <dd className="text-gray-200">{detail.anagrafica.phone ?? "—"}</dd>
            <dt className="text-gray-500">Aggiornata</dt>
            <dd className="text-gray-400">{fmtDate(detail.anagrafica.updatedAt)}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-gray-500">{COPY.anagraficaEmpty}</p>
        )}
      </section>
    </div>
  );
}
