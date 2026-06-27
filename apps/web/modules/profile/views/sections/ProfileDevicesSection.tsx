"use client";

import { useEffect, useState } from "react";
import { ManualIntegrationPullButton } from "@/components/integrations/ManualIntegrationPullButton";
import { SettingsDataSourcePreference } from "@/components/settings/SettingsDataSourcePreference";
import { SettingsDeviceIngestPolicy } from "@/components/settings/SettingsDeviceIngestPolicy";
import { Pro2Button } from "@/components/ui/empathy";

/**
 * Sezione "Devices" di ProfilePageView (decomposizione del God-component).
 *
 * A differenza delle sezioni render-only, questo componente è AUTONOMO: incapsula
 * il proprio stato (link/return/pull per ogni provider), gli effetti device
 * (OAuth-return banner da query param + fetch link-status) e gli handler async
 * (disconnect/pull). NON tocca il mega-oggetto draft `form` del padre, quindi è la
 * sezione più sicura da estrarre.
 *
 * CONTRATTO DI CORRETTEZZA: gli effetti device giravano al MOUNT della pagina,
 * indipendentemente dal tab attivo (es. l'OAuth-return deve girare al ritorno
 * anche se il tab non è "devices"). Per preservare il timing, il padre monta
 * SEMPRE questo componente e passa `active` per nascondere solo il JSX. Gli
 * effetti/handler girano INCONDIZIONATAMENTE; il render restituisce
 * `active ? <JSX> : null`.
 */
export function ProfileDevicesSection({
  activeAthleteId,
  hasActivePlan,
  active,
}: {
  activeAthleteId: string | null;
  hasActivePlan: boolean;
  active: boolean;
}) {
  const [garminLink, setGarminLink] = useState<{ linked: boolean } | null>(null);
  const [garminReturn, setGarminReturn] = useState<string | null>(null);
  const [garminDisconnecting, setGarminDisconnecting] = useState(false);
  const [whoopLink, setWhoopLink] = useState<{ linked: boolean } | null>(null);
  const [whoopReturn, setWhoopReturn] = useState<string | null>(null);
  const [whoopPullBusy, setWhoopPullBusy] = useState(false);
  const [whoopPullNotice, setWhoopPullNotice] = useState<string | null>(null);
  const [wahooLink, setWahooLink] = useState<{ linked: boolean } | null>(null);
  const [wahooReturn, setWahooReturn] = useState<string | null>(null);
  const [wahooPullBusy, setWahooPullBusy] = useState(false);
  const [wahooPullNotice, setWahooPullNotice] = useState<string | null>(null);
  const [stravaLink, setStravaLink] = useState<{ linked: boolean } | null>(null);
  const [stravaReturn, setStravaReturn] = useState<string | null>(null);
  const [polarLink, setPolarLink] = useState<{ linked: boolean } | null>(null);
  const [polarReturn, setPolarReturn] = useState<string | null>(null);
  const [polarPullBusy, setPolarPullBusy] = useState(false);
  const [polarPullNotice, setPolarPullNotice] = useState<string | null>(null);
  const [suuntoLink, setSuuntoLink] = useState<{ linked: boolean } | null>(null);
  const [suuntoReturn, setSuuntoReturn] = useState<string | null>(null);
  const [suuntoPullBusy, setSuuntoPullBusy] = useState(false);
  const [suuntoPullNotice, setSuuntoPullNotice] = useState<string | null>(null);
  const [karooLink, setKarooLink] = useState<{ linked: boolean } | null>(null);
  const [karooReturn, setKarooReturn] = useState<string | null>(null);
  const [karooPullBusy, setKarooPullBusy] = useState(false);
  const [karooPullNotice, setKarooPullNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const wahoo = q.get("wahoo");
    const whoop = q.get("whoop");
    const strava = q.get("strava");
    const polar = q.get("polar");
    if (wahoo) {
      setWahooReturn(wahoo);
    } else if (whoop) {
      setWhoopReturn(whoop);
    } else if (polar) {
      setPolarReturn(polar);
    } else if (q.get("suunto")) {
      setSuuntoReturn(q.get("suunto"));
    } else if (q.get("karoo")) {
      setKarooReturn(q.get("karoo"));
    } else if (strava) {
      setStravaReturn(strava);
    } else {
      const p = q.get("garmin");
      if (p) setGarminReturn(p);
    }
  }, []);

  useEffect(() => {
    if (!activeAthleteId) {
      setGarminLink(null);
      setWhoopLink(null);
      setWahooLink(null);
      setStravaLink(null);
      setPolarLink(null);
      setSuuntoLink(null);
      setKarooLink(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [rG, rWhoop, rWahoo, rStrava, rPolar, rSuunto, rKaroo] = await Promise.all([
          fetch(`/api/integrations/garmin/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/whoop/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/wahoo/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/strava/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/polar/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/suunto/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/integrations/karoo/link-status?athleteId=${encodeURIComponent(activeAthleteId)}`, {
            credentials: "include",
          }),
        ]);
        const jG = (await rG.json()) as { linked?: boolean };
        const jWhoop = (await rWhoop.json()) as { linked?: boolean };
        const jWahoo = (await rWahoo.json()) as { linked?: boolean };
        const jStrava = (await rStrava.json()) as { linked?: boolean };
        const jPolar = (await rPolar.json()) as { linked?: boolean };
        const jSuunto = (await rSuunto.json()) as { linked?: boolean };
        const jKaroo = (await rKaroo.json()) as { linked?: boolean };
        if (cancelled) return;
        setGarminLink({ linked: rG.ok && Boolean(jG.linked) });
        setWhoopLink({ linked: rWhoop.ok && Boolean(jWhoop.linked) });
        setWahooLink({ linked: rWahoo.ok && Boolean(jWahoo.linked) });
        setStravaLink({ linked: rStrava.ok && Boolean(jStrava.linked) });
        setPolarLink({ linked: rPolar.ok && Boolean(jPolar.linked) });
        setSuuntoLink({ linked: rSuunto.ok && Boolean(jSuunto.linked) });
        setKarooLink({ linked: rKaroo.ok && Boolean(jKaroo.linked) });
      } catch {
        if (!cancelled) {
          setGarminLink({ linked: false });
          setWhoopLink({ linked: false });
          setWahooLink({ linked: false });
          setStravaLink({ linked: false });
          setPolarLink({ linked: false });
          setSuuntoLink({ linked: false });
          setKarooLink({ linked: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAthleteId]);

  async function disconnectGarmin() {
    if (!activeAthleteId || garminDisconnecting) return;
    if (!window.confirm("Scollegare Garmin da questo atleta? I dati non verranno più sincronizzati da Garmin.")) {
      return;
    }
    setGarminDisconnecting(true);
    try {
      const r = await fetch(`/api/integrations/garmin/disconnect?athleteId=${encodeURIComponent(activeAthleteId)}`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; garminPartnerDeregistered?: boolean };
      if (!r.ok) {
        window.alert(j.error ?? "Scollegamento non riuscito.");
        return;
      }
      if (j.garminPartnerDeregistered === false) {
        window.alert(
          "Collegamento rimosso in Empathy; se Garmin non ha accettato la revoca, rimuovi il consenso anche da Garmin Connect.",
        );
      }
      setGarminLink({ linked: false });
    } catch {
      window.alert("Errore di rete durante lo scollegamento.");
    } finally {
      setGarminDisconnecting(false);
    }
  }

  async function runWahooPullNow() {
    if (!activeAthleteId || !wahooLink?.linked || wahooPullBusy) return;
    setWahooPullBusy(true);
    setWahooPullNotice(null);
    try {
      const r = await fetch("/api/integrations/wahoo/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setWahooPullNotice(
          `Pull workout completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setWahooPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setWahooPullNotice("Errore di rete.");
    } finally {
      setWahooPullBusy(false);
    }
  }

  async function runWhoopPullNow() {
    if (!activeAthleteId || !whoopLink?.linked || whoopPullBusy) return;
    setWhoopPullBusy(true);
    setWhoopPullNotice(null);
    try {
      const r = await fetch("/api/integrations/whoop/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setWhoopPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setWhoopPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setWhoopPullNotice("Errore di rete.");
    } finally {
      setWhoopPullBusy(false);
    }
  }

  async function runPolarPullNow() {
    if (!activeAthleteId || !polarLink?.linked || polarPullBusy) return;
    setPolarPullBusy(true);
    setPolarPullNotice(null);
    try {
      const r = await fetch("/api/integrations/polar/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setPolarPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setPolarPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setPolarPullNotice("Errore di rete.");
    } finally {
      setPolarPullBusy(false);
    }
  }

  async function runSuuntoPullNow() {
    if (!activeAthleteId || !suuntoLink?.linked || suuntoPullBusy) return;
    setSuuntoPullBusy(true);
    setSuuntoPullNotice(null);
    try {
      const r = await fetch("/api/integrations/suunto/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setSuuntoPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setSuuntoPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setSuuntoPullNotice("Errore di rete.");
    } finally {
      setSuuntoPullBusy(false);
    }
  }

  async function runKarooPullNow() {
    if (!activeAthleteId || !karooLink?.linked || karooPullBusy) return;
    setKarooPullBusy(true);
    setKarooPullNotice(null);
    try {
      const r = await fetch("/api/integrations/karoo/pull/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: activeAthleteId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (j.ok) {
        setKarooPullNotice(
          `Pull completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 3).join(" · ")}` : ""),
        );
      } else {
        setKarooPullNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setKarooPullNotice("Errore di rete.");
    } finally {
      setKarooPullBusy(false);
    }
  }

  if (!active) return null;

  return (
    <div>
      <div className="profile-subpanel tone-slate" style={{ marginTop: "12px" }}>
        <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Devices</h4>
        <p className="muted-copy">Collega i tuoi dispositivi per sincronizzare automaticamente allenamenti e dati di salute.</p>
        {garminReturn === "connected" ? (
          <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>Garmin collegato ✓</p>
        ) : null}
        {garminReturn && garminReturn !== "connected" ? (
          <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>Collegamento non riuscito, riprova.</p>
        ) : null}
        {whoopReturn === "ok" ? (
          <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>WHOOP collegato ✓</p>
        ) : null}
        {whoopReturn && whoopReturn !== "ok" ? (
          <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>Collegamento non riuscito, riprova.</p>
        ) : null}
        {polarReturn === "ok" ? (
          <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>Polar collegato ✓</p>
        ) : null}
        {polarReturn && polarReturn !== "ok" ? (
          <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>Collegamento non riuscito, riprova.</p>
        ) : null}
        {wahooReturn === "ok" ? (
          <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>Wahoo collegato ✓</p>
        ) : null}
        {wahooReturn && wahooReturn !== "ok" ? (
          <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>Collegamento non riuscito, riprova.</p>
        ) : null}
        {stravaReturn === "ok" ? (
          <p className="text-sm text-emerald-400/90" style={{ marginTop: 8 }}>Strava collegato ✓</p>
        ) : null}
        {stravaReturn && stravaReturn !== "ok" ? (
          <p className="text-sm text-rose-400/90" style={{ marginTop: 8 }}>Collegamento non riuscito, riprova.</p>
        ) : null}
        {activeAthleteId && garminLink && whoopLink && wahooLink && stravaLink ? (
          <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
            {garminLink.linked ? (
              <p className="muted-copy text-sm">Garmin collegato</p>
            ) : (
              <p className="muted-copy text-sm">Garmin non collegato</p>
            )}
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={`/api/integrations/garmin/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                target="_self"
                rel="noopener noreferrer"
                className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                {garminLink.linked ? "Ricollega Garmin" : "Collega Garmin"}
              </a>
              {garminLink.linked ? (
                <Pro2Button
                  type="button"
                  variant="secondary"
                  disabled={garminDisconnecting}
                  className="border border-rose-500/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                  onClick={() => void disconnectGarmin()}
                >
                  {garminDisconnecting ? "Scollegamento…" : "Scollega Garmin"}
                </Pro2Button>
              ) : null}
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                <span className="profile-kpi-dot" />
                WHOOP
              </h4>
              {whoopLink.linked ? (
                <p className="muted-copy text-sm">WHOOP collegato</p>
              ) : (
                <p className="muted-copy text-sm">WHOOP non collegato</p>
              )}
              <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href={`/api/integrations/whoop/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                >
                  {whoopLink.linked ? "Ricollega WHOOP" : "Collega WHOOP"}
                </a>
                {whoopLink.linked ? (
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    disabled={whoopPullBusy}
                    className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                    onClick={() => void runWhoopPullNow()}
                  >
                    {whoopPullBusy ? "Pull…" : "Aggiorna dati WHOOP"}
                  </Pro2Button>
                ) : null}
              </div>
              {whoopPullNotice ? (
                <p className="muted-copy mt-2 text-xs text-white/80">{whoopPullNotice}</p>
              ) : null}
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                <span className="profile-kpi-dot" />
                Polar
              </h4>
              {polarLink?.linked ? (
                <p className="muted-copy text-sm">Polar collegato</p>
              ) : (
                <p className="muted-copy text-sm">Polar non collegato</p>
              )}
              <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href={`/api/integrations/polar/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                >
                  {polarLink?.linked ? "Ricollega Polar" : "Collega Polar"}
                </a>
                {polarLink?.linked ? (
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    disabled={polarPullBusy}
                    className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                    onClick={() => void runPolarPullNow()}
                  >
                    {polarPullBusy ? "Pull…" : "Aggiorna dati Polar"}
                  </Pro2Button>
                ) : null}
              </div>
              {polarPullNotice ? (
                <p className="muted-copy mt-2 text-xs text-white/80">{polarPullNotice}</p>
              ) : null}
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                <span className="profile-kpi-dot" />
                Suunto
              </h4>
              {suuntoReturn === "ok" ? (
                <p className="text-sm text-emerald-300/90">Suunto collegato ✓</p>
              ) : null}
              {suuntoReturn && suuntoReturn !== "ok" ? (
                <p className="text-sm text-rose-400/90">Collegamento non riuscito, riprova.</p>
              ) : null}
              {suuntoLink?.linked ? (
                <p className="muted-copy text-sm">Suunto collegato</p>
              ) : (
                <p className="muted-copy text-sm">Suunto non collegato</p>
              )}
              <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href={`/api/integrations/suunto/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                >
                  {suuntoLink?.linked ? "Ricollega Suunto" : "Collega Suunto"}
                </a>
                {suuntoLink?.linked ? (
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    disabled={suuntoPullBusy}
                    className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                    onClick={() => void runSuuntoPullNow()}
                  >
                    {suuntoPullBusy ? "Pull…" : "Aggiorna dati Suunto"}
                  </Pro2Button>
                ) : null}
              </div>
              {suuntoPullNotice ? (
                <p className="muted-copy mt-2 text-xs text-white/80">{suuntoPullNotice}</p>
              ) : null}
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                <span className="profile-kpi-dot" />
                Karoo (Hammerhead)
              </h4>
              {karooReturn === "ok" ? (
                <p className="text-sm text-emerald-300/90">Karoo collegato ✓</p>
              ) : null}
              {karooReturn && karooReturn !== "ok" ? (
                <p className="text-sm text-rose-400/90">Collegamento non riuscito, riprova.</p>
              ) : null}
              {karooLink?.linked ? (
                <p className="muted-copy text-sm">Karoo collegato</p>
              ) : (
                <p className="muted-copy text-sm">Karoo non collegato</p>
              )}
              <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href={`/api/integrations/karoo/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                >
                  {karooLink?.linked ? "Ricollega Karoo" : "Collega Karoo"}
                </a>
                {karooLink?.linked ? (
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    disabled={karooPullBusy}
                    className="border border-violet-500/35 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                    onClick={() => void runKarooPullNow()}
                  >
                    {karooPullBusy ? "Pull…" : "Aggiorna dati Karoo"}
                  </Pro2Button>
                ) : null}
              </div>
              {karooPullNotice ? (
                <p className="muted-copy mt-2 text-xs text-white/80">{karooPullNotice}</p>
              ) : null}
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                <span className="profile-kpi-dot" />
                Zepp <span className="text-white/50">· in arrivo</span>
              </h4>
              <p className="muted-copy text-sm">
                Integrazione Zepp in arrivo: il collegamento sarà attivato a breve.
              </p>
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                <span className="profile-kpi-dot" />
                Wahoo Cloud
              </h4>
              {wahooLink.linked ? (
                <p className="muted-copy text-sm">Wahoo collegato</p>
              ) : (
                <p className="muted-copy text-sm">Wahoo non collegato</p>
              )}
              <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href={`/api/integrations/wahoo/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-fit items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                >
                  {wahooLink.linked ? "Ricollega Wahoo" : "Collega Wahoo"}
                </a>
                {wahooLink.linked ? (
                  <Pro2Button
                    type="button"
                    variant="secondary"
                    disabled={wahooPullBusy}
                    className="border border-sky-500/35 bg-sky-500/10 text-sky-50 hover:bg-sky-500/20"
                    onClick={() => void runWahooPullNow()}
                  >
                    {wahooPullBusy ? "Pull…" : "Aggiorna workout Wahoo"}
                  </Pro2Button>
                ) : null}
              </div>
              {wahooPullNotice ? (
                <p className="muted-copy mt-2 text-xs text-white/80">{wahooPullNotice}</p>
              ) : null}
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h4 className="profile-editor-subtitle" style={{ marginBottom: 8 }}>
                <span className="profile-kpi-dot" />
                Strava
              </h4>
              {stravaLink.linked ? (
                <p className="muted-copy text-sm">Strava collegato</p>
              ) : (
                <p className="muted-copy text-sm">Strava non collegato</p>
              )}
              <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href={`/api/integrations/strava/authorize?athleteId=${encodeURIComponent(activeAthleteId)}`}
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-fit items-center justify-center rounded-lg border border-orange-500/35 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-50 hover:bg-orange-500/20"
                >
                  {stravaLink.linked ? "Ricollega Strava" : "Collega Strava"}
                </a>
                <ManualIntegrationPullButton
                  athleteId={activeAthleteId}
                  linked={Boolean(stravaLink.linked)}
                  endpoint="/api/integrations/strava/pull/run"
                  label="Aggiorna attività Strava"
                />
              </div>
            </div>
          </div>
        ) : null}
        {hasActivePlan ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Quali dati prendere dai dispositivi</h4>
            <p className="muted-copy" style={{ marginBottom: 8 }}>
              Scegli da quale dispositivo arrivano sonno, recupero e allenamenti, e quali dati ogni device può sincronizzare.
            </p>
            <div className="flex flex-col gap-6" style={{ marginTop: 8 }}>
              <SettingsDataSourcePreference />
              <SettingsDeviceIngestPolicy />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
