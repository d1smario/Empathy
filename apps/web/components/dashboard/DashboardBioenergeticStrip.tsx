"use client";

/**
 * Box "Striscia 24 h" della Bioenergetica montato nella dashboard (e riusato
 * dalla pagina scoped /bioenergetics di coach/admin). Self-contained: gestisce
 * il fetch del view model giornaliero per OGGI (stesso endpoint/headers della
 * vecchia pagina) e la cache cross-mount. Rende SOLO una Pro2SectionCard con
 * `<BioenergeticsContinuousMonitoringGrid />` — niente shell/subnav/day-picker,
 * niente metric tiles, niente "Da tenere a mente", niente "Dettagli e motore":
 * quelle restano responsabilità del chiamante (qui: nessuno).
 */

import { useEffect, useState } from "react";
import { LineChart } from "lucide-react";
import type { BioenergeticsDayViewModel } from "@/api/bioenergetics/contracts";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { BioenergeticsContinuousMonitoringGrid } from "@/modules/bioenergetics/components/BioenergeticsContinuousMonitoringGrid";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Cache cross-mount + sessionStorage della giornata bioenergetica (keyed athleteId+date).
// Ri-atterrando sulla dashboard i dati compaiono SUBITO (init sincrono da cache: niente
// skeleton/refresh) e — se la cache è fresca (<5 min) — non rifacciamo nemmeno il fetch
// in background dell'endpoint pesante /api/bioenergetics/day. sessionStorage fa
// sopravvivere la cache anche al reload del browser (stessa scheda). La chiave composta
// garantisce di non mostrare mai i dati di un altro atleta o di un altro giorno.
const STRIP_FRESH_MS = 5 * 60 * 1000;
const STRIP_SS_PREFIX = "bio-day:";
type BioDayCacheEntry = { vm: BioenergeticsDayViewModel; ts: number };
const bioDayVmCache = new Map<string, BioDayCacheEntry>();
function bioDayCacheKey(athleteId: string, date: string): string {
  return `${athleteId}::${date}`;
}
function readBioDayCache(key: string): BioDayCacheEntry | null {
  const mem = bioDayVmCache.get(key);
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STRIP_SS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BioDayCacheEntry;
    if (parsed?.vm) {
      bioDayVmCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // sessionStorage non disponibile / JSON corrotto: ignora.
  }
  return null;
}
function writeBioDayCache(key: string, vm: BioenergeticsDayViewModel): void {
  const entry: BioDayCacheEntry = { vm, ts: Date.now() };
  bioDayVmCache.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STRIP_SS_PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota/serializzazione: la cache in-memory basta comunque.
  }
}

export function DashboardBioenergeticStrip() {
  const { athleteId, loading: athleteLoading, adminScoped, role } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  const date = toIsoDate(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vm, setVm] = useState<BioenergeticsDayViewModel | null>(() =>
    athleteId ? (readBioDayCache(bioDayCacheKey(athleteId, date))?.vm ?? null) : null,
  );

  useEffect(() => {
    if (athleteLoading) return;
    if (!athleteId) {
      setVm(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const cacheKey = bioDayCacheKey(athleteId, date);
    const cached = readBioDayCache(cacheKey);
    if (cached) {
      // Mostra subito i dati in cache: niente skeleton/refresh all'atterraggio.
      setVm(cached.vm);
      setError(null);
      setLoading(false);
      // Cache fresca: non rifacciamo nemmeno il fetch in background (niente "refresh").
      if (Date.now() - cached.ts < STRIP_FRESH_MS) return;
    }
    (async () => {
      if (!cached) {
        setLoading(true);
        setError(null);
      }
      try {
        const q = new URLSearchParams({ athleteId, date, stripAudit: "1" });
        const res = await fetch(`/api/bioenergetics/day?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as BioenergeticsDayViewModel & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          // Con cache già mostrata, non sovrascriverla con un errore di refresh in background.
          if (!cached) {
            setVm(null);
            setError(json.error ?? "Non è stato possibile caricare la giornata.");
          }
          return;
        }
        const cm = json.continuousMonitoring as BioenergeticsDayViewModel["continuousMonitoring"] | undefined;
        const vmPayload: BioenergeticsDayViewModel = {
          ...json,
          dayContractVersion: json.dayContractVersion ?? 1,
          canonicalStreamCounts: json.canonicalStreamCounts ?? {
            glucoseSampleCount: 0,
            lactateSampleCount: 0,
          },
          series: Array.isArray(json.series) ? json.series : [],
          evidenceConditionedLayer: json.evidenceConditionedLayer ?? null,
          continuousMonitoring:
            cm &&
            typeof cm === "object" &&
            (cm.layer === "model_continuous_v1" || cm.layer === "ai_from_inputs_v1") &&
            Array.isArray(cm.channels)
              ? cm
              : undefined,
        };
        writeBioDayCache(cacheKey, vmPayload);
        setVm(vmPayload);
      } catch {
        // Con cache già mostrata, lascia i dati visibili e non mostrare l'errore di rete del refresh.
        if (!cancelled && !cached) {
          setVm(null);
          setError("Errore di rete durante il caricamento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, athleteLoading, date]);

  // La striscia è SEMPRE modellata (curve circadiane) anche senza input reali: per
  // non mostrare dati inventati a un utente nuovo, la rendiamo solo quando la giornata
  // ha almeno un input reale — eventi in timeline (pasti, allenamenti, esami, export
  // device) oppure campioni stream (glucosio/lattato). Altrimenti: "nessun dato".
  const hasRealInputs = Boolean(
    vm &&
      ((vm.timeline?.length ?? 0) > 0 ||
        (vm.canonicalStreamCounts?.glucoseSampleCount ?? 0) > 0 ||
        (vm.canonicalStreamCounts?.lactateSampleCount ?? 0) > 0),
  );

  return (
    <Pro2SectionCard
      accent="lime"
      title="Striscia 24 h"
      subtitle="Andamento della tua giornata, costantemente aggiornato. Quando arriva una misura reale, prende il posto della stima."
      icon={LineChart}
    >
      {error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : athleteLoading || (loading && !vm) ? (
        <div className="space-y-2">
          <div className="h-3 w-full max-w-xl animate-pulse rounded bg-white/10" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : vm &&
        hasRealInputs &&
        vm.continuousMonitoring &&
        (vm.continuousMonitoring.channels.length > 0 || vm.continuousMonitoring.layer === "ai_from_inputs_v1") ? (
        <div className="space-y-4">
          {vm.continuousMonitoring.channels.length === 0 && vm.continuousMonitoring.layer === "ai_from_inputs_v1" ? (
            <p className="rounded-xl border border-lime-500/25 bg-lime-500/10 px-3 py-2 text-[0.7rem] leading-relaxed text-lime-100/95">
              {showTech
                ? "Nessuna curva generata: verifica configurazione OpenAI e risposta JSON (vedi disclaimer)."
                : "Curve non disponibili per questa giornata: prova ad aggiornare più tardi."}
            </p>
          ) : null}
          {vm.continuousMonitoring.channels.length > 0 ? (
            <BioenergeticsContinuousMonitoringGrid monitoring={vm.continuousMonitoring} showTech={showTech} />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Nessun dato per oggi. La striscia 24 h si popola con misure reali da device, pasti, allenamenti o esami.
        </p>
      )}
    </Pro2SectionCard>
  );
}
