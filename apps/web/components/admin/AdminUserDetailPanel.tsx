"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminCoachRow } from "@/lib/admin/coach-list-types";
import type { AdminUserAnagraficaRow } from "@/lib/admin/user-directory-types";

const COPY = {
  loading: "Caricamento dettaglio…",
  unavailable: "Dettaglio non disponibile.",
  account: "Account",
  access: "Accesso piattaforma",
  anagrafica: "Anagrafica · fatturazione",
  anagraficaEmpty:
    "Anagrafica non compilata: l'utente non ha ancora inserito i dati di fatturazione (indirizzo richiesto per fatture/ricevute CH).",
  coach: "Coach assegnato",
  coachExclusive: "Un atleta ha un solo coach: assegnarne uno sostituisce il precedente.",
  coachNone: "Nessun coach assegnato.",
  coachOnCoach: "Gli account coach non possono avere un coach assegnato.",
  coachNoAthlete:
    "Nessun atleta collegato al profilo: assegnazione coach non disponibile finché l'utente non completa un accesso.",
  coachAssign: "Assegna",
  coachUnlink: "Scollega",
  coachSelect: "Seleziona un coach approvato…",
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
  assignedCoach?: { userId: string; email: string | null } | null;
  garmin?: { connected: boolean; garminUserId: string | null; updatedAt: string | null; tokenExpiresAt: string | null } | null;
};

/**
 * Card Account + Accesso + Anagrafica per un utente (fonte: API admin detail).
 * Usato dal pannello laterale della tabella Utenti e dalla pagina overview
 * dell'utente selezionato (/admin/utenti/[id]).
 */
export function AdminUserDetailPanel({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<AdminCoachRow[]>([]);
  const [selectedCoach, setSelectedCoach] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [garminBusy, setGarminBusy] = useState(false);
  const [garminMsg, setGarminMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadDetail = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/detail`, { cache: "no-store" });
    const data = (await res.json()) as AdminUserDetail;
    setDetail(data);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCoachError(null);
    setSelectedCoach("");
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

  // Elenco coach approvati per il selettore di assegnazione.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/coaches", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; coaches?: AdminCoachRow[] };
        if (cancelled) return;
        const approved = (data.coaches ?? []).filter((c) => c.platformCoachStatus === "approved");
        setCoaches(approved);
      } catch {
        if (!cancelled) setCoaches([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const assignCoach = useCallback(async (): Promise<void> => {
    if (!selectedCoach) return;
    setCoachBusy(true);
    setCoachError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/coach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coachUserId: selectedCoach }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setCoachError(data.error ?? "Assegnazione non riuscita.");
        return;
      }
      setSelectedCoach("");
      await loadDetail();
    } catch {
      setCoachError("Assegnazione non riuscita.");
    } finally {
      setCoachBusy(false);
    }
  }, [selectedCoach, userId, loadDetail]);

  const unlinkCoach = useCallback(async (): Promise<void> => {
    setCoachBusy(true);
    setCoachError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/coach`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setCoachError(data.error ?? "Scollegamento non riuscito.");
        return;
      }
      await loadDetail();
    } catch {
      setCoachError("Scollegamento non riuscito.");
    } finally {
      setCoachBusy(false);
    }
  }, [userId, loadDetail]);

  const changePassword = useCallback(async (): Promise<void> => {
    setPwdMsg(null);
    if (pwd.length < 8) {
      setPwdMsg({ ok: false, text: "La password deve avere almeno 8 caratteri." });
      return;
    }
    if (pwd !== pwd2) {
      setPwdMsg({ ok: false, text: "Le due password non coincidono." });
      return;
    }
    setPwdBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setPwdMsg({ ok: false, text: data.error ?? "Aggiornamento non riuscito." });
        return;
      }
      setPwd("");
      setPwd2("");
      setPwdMsg({ ok: true, text: "Password aggiornata. Comunicala all'utente." });
    } catch {
      setPwdMsg({ ok: false, text: "Aggiornamento non riuscito." });
    } finally {
      setPwdBusy(false);
    }
  }, [pwd, pwd2, userId]);

  const disconnectGarmin = useCallback(async (): Promise<void> => {
    if (
      !window.confirm(
        "Scollegare Garmin per questo utente? Rimuove il collegamento e prova a deregistrare lato Garmin. I workout storici restano.",
      )
    ) {
      return;
    }
    setGarminMsg(null);
    setGarminBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/garmin`, { method: "DELETE" });
      const data = (await res.json()) as {
        ok?: boolean;
        disconnected?: boolean;
        garminPartnerDeregistered?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setGarminMsg({ ok: false, text: data.error ?? "Scollegamento non riuscito." });
        return;
      }
      setGarminMsg({
        ok: true,
        text: data.disconnected
          ? data.garminPartnerDeregistered
            ? "Garmin scollegato (deregistrato anche lato Garmin)."
            : "Garmin scollegato (link locale rimosso; deregistrazione lato Garmin non confermata — l'utente può revocare l'app in Garmin Connect)."
          : "Nessun dispositivo Garmin collegato.",
      });
      await loadDetail();
    } catch {
      setGarminMsg({ ok: false, text: "Scollegamento non riuscito." });
    } finally {
      setGarminBusy(false);
    }
  }, [userId, loadDetail]);

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

      {/* Cambia password (platform admin → auth.admin.updateUserById via API service-role) */}
      <section className="rounded-2xl border border-amber-400/20 bg-white/[0.03] p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-amber-300/80">Cambia password</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
          Imposta una nuova password per questo utente. Non viene inviata via email: comunicagliela tu.
        </p>
        <div className="mt-3 space-y-2">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            disabled={pwdBusy}
            autoComplete="new-password"
            placeholder="Nuova password (min 8 caratteri)"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-amber-400/50 disabled:opacity-50"
          />
          <input
            type="password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            disabled={pwdBusy}
            autoComplete="new-password"
            placeholder="Conferma nuova password"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-amber-400/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void changePassword()}
            disabled={pwdBusy || !pwd || !pwd2}
            className="w-full rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pwdBusy ? "Aggiornamento…" : "Imposta nuova password"}
          </button>
        </div>
        {pwdMsg ? (
          <p className={`mt-2 text-[11px] ${pwdMsg.ok ? "text-emerald-400" : "text-red-400"}`} role="alert">
            {pwdMsg.text}
          </p>
        ) : null}
      </section>

      {/* Dispositivo Garmin (platform admin → scollega + deregister best-effort) */}
      {detail.profile?.athleteId ? (
        <section className="rounded-2xl border border-rose-400/20 bg-white/[0.03] p-5">
          <h3 className="text-[11px] uppercase tracking-wider text-rose-300/80">Dispositivo Garmin</h3>
          {detail.garmin?.connected ? (
            <p className="mt-2 text-xs text-gray-300">
              Collegato
              {detail.garmin.garminUserId ? (
                <>
                  {" · "}
                  <span className="break-all font-mono text-[11px] text-zinc-400">{detail.garmin.garminUserId}</span>
                </>
              ) : null}
              {detail.garmin.updatedAt ? <span className="text-gray-500"> · dal {fmtDate(detail.garmin.updatedAt)}</span> : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Nessun dispositivo Garmin collegato.</p>
          )}
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            Rimuove il collegamento e prova a deregistrare lato Garmin. I workout storici restano. Serve per ripulire un
            collegamento pasticciato e permettere un nuovo connect pulito.
          </p>
          <button
            type="button"
            onClick={() => void disconnectGarmin()}
            disabled={garminBusy || !detail.garmin?.connected}
            className="mt-3 w-full rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {garminBusy ? "Scollegamento…" : "Scollega Garmin"}
          </button>
          {garminMsg ? (
            <p className={`mt-2 text-[11px] ${garminMsg.ok ? "text-emerald-400" : "text-red-400"}`} role="alert">
              {garminMsg.text}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Coach assegnato (ESCLUSIVO) */}
      <section className="rounded-2xl border border-violet-400/20 bg-white/[0.03] p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-violet-300/80">{COPY.coach}</h3>
        {detail.profile?.role === "coach" ? (
          <p className="mt-3 text-xs leading-relaxed text-gray-500">{COPY.coachOnCoach}</p>
        ) : !detail.profile?.athleteId ? (
          <p className="mt-3 text-xs leading-relaxed text-gray-500">{COPY.coachNoAthlete}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-200">
              {detail.assignedCoach ? (
                <span className="break-all font-medium text-white">{detail.assignedCoach.email ?? detail.assignedCoach.userId}</span>
              ) : (
                <span className="text-gray-500">{COPY.coachNone}</span>
              )}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{COPY.coachExclusive}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={selectedCoach}
                onChange={(e) => setSelectedCoach(e.target.value)}
                disabled={coachBusy}
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-violet-400/50 disabled:opacity-50"
              >
                <option value="">{COPY.coachSelect}</option>
                {coaches.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.email ?? c.userId}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void assignCoach()}
                disabled={coachBusy || !selectedCoach}
                className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {COPY.coachAssign}
              </button>
              {detail.assignedCoach ? (
                <button
                  type="button"
                  onClick={() => void unlinkCoach()}
                  disabled={coachBusy}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {COPY.coachUnlink}
                </button>
              ) : null}
            </div>

            {coachError ? (
              <p className="mt-2 text-[11px] text-red-400" role="alert">
                {coachError}
              </p>
            ) : null}
          </>
        )}
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
