"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, LineChart, Timer } from "lucide-react";
import type {
  BioenergeticMetricTile,
  BioenergeticMetricTileCategory,
  BioenergeticPathwayImpact,
  BioenergeticTimelineEvent,
  BioenergeticsDayViewModel,
} from "@/api/bioenergetics/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link, pro2ButtonClassName } from "@/components/ui/empathy";
import { Pro2Accordion } from "@/components/ui/empathy/Pro2Accordion";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { cn } from "@/lib/cn";
import {
  readPersistedNutritionPlanDate,
  writePersistedNutritionPlanDate,
} from "@/lib/nutrition/persisted-nutrition-plan-date";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { BioenergeticsContinuousMonitoringGrid } from "@/modules/bioenergetics/components/BioenergeticsContinuousMonitoringGrid";
import { BioenergeticsStripAuditPanel } from "@/modules/bioenergetics/components/BioenergeticsStripAuditPanel";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function coerceIsoDate(s: string | null | undefined): string | null {
  const u = (s ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(u) ? u : null;
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

const CATEGORY_LABEL: Record<BioenergeticMetricTileCategory, string> = {
  metabolic: "Metabolismo & substrati",
  inflammatory: "Infiammazione (contesto)",
  hormonal: "Ormonale",
  neural: "Neuromodulatori",
  gastro_intestinal: "Gastro-enterico",
  gonadal: "Asse gonadico",
};

function impactTileClass(impact: BioenergeticPathwayImpact): string {
  if (impact === "supportive") return "border-emerald-400/35 bg-emerald-500/[0.07]";
  if (impact === "inhibitory") return "border-rose-400/35 bg-rose-500/[0.07]";
  return "border-white/12 bg-white/[0.04]";
}

function provenanceLabel(p: BioenergeticMetricTile["provenance"]): string {
  if (p === "measured") return "Misurato";
  if (p === "estimated") return "Stimato";
  if (p === "planned") return "Da piano";
  return "Assente";
}

const TIMELINE_MODEL_TYPES = new Set<BioenergeticTimelineEvent["type"]>(["meal", "planned_session", "executed_session"]);

// Disclaimer tecnici da NON mostrare all'atleta (nomi tabella/colonna DB, identificatori motore,
// kernel/skeleton/policy fusione, env var, predittori). Restano visibili solo a coach/admin.
const DISCLAIMER_TECH_MARKERS = [
  "athlete_time_series_samples",
  "planned_workouts",
  "kernel",
  "skeleton",
  "policy fusione",
  "fusione v1",
  "modello:",
  "banca coefficienti",
  "nutrition_plans",
  "calendar_training_solver",
  "_predictor_",
  "buildSimulated",
  "stimulusPredictor",
  "SIM_",
  "OPENAI_API_KEY",
  "boundary adapter",
  "endpoint e schema",
];

// Errori grezzi LLM / chiave assente: per l'atleta diventano un singolo messaggio generico.
const DISCLAIMER_LLM_ERROR_MARKERS = [
  "openai:",
  "openai http",
  "json non interpretabile",
  "imposta openai_api_key",
  "openai_api_key",
];

// Menzioni informative del fornitore AI: per l'atleta vanno semplicemente nascoste (niente vendor name).
const DISCLAIMER_LLM_VENDOR_MARKERS = ["openai", "llm"];

const ATHLETE_LLM_FALLBACK_DISCLAIMER = "Stima temporaneamente non disponibile: riprova tra qualche minuto.";

function disclaimerIsTech(line: string): boolean {
  const low = line.toLowerCase();
  if (line.includes("`")) return true; // qualsiasi identificatore tecnico in backtick
  return DISCLAIMER_TECH_MARKERS.some((m) => low.includes(m.toLowerCase()));
}

function disclaimerIsLlmError(line: string): boolean {
  const low = line.toLowerCase();
  return DISCLAIMER_LLM_ERROR_MARKERS.some((m) => low.includes(m));
}

function disclaimerMentionsVendor(line: string): boolean {
  const low = line.toLowerCase();
  return DISCLAIMER_LLM_VENDOR_MARKERS.some((m) => low.includes(m));
}

/** Vista atleta: solo voci comprensibili; errori LLM → un solo messaggio generico, vendor name nascosto. */
function athleteDisclaimers(lines: string[]): string[] {
  const out: string[] = [];
  let llmFallbackAdded = false;
  for (const line of lines) {
    if (disclaimerIsLlmError(line)) {
      if (!llmFallbackAdded) {
        out.push(ATHLETE_LLM_FALLBACK_DISCLAIMER);
        llmFallbackAdded = true;
      }
      continue;
    }
    if (disclaimerMentionsVendor(line)) continue; // menzione informativa del fornitore AI
    if (disclaimerIsTech(line)) continue;
    out.push(line);
  }
  return out;
}

// Cache cross-mount della giornata bioenergetica, keyed by athleteId+date: ri-atterrando
// sulla pagina (stesso atleta/giorno) i dati compaiono subito (niente spinner/skeleton),
// con refetch in background silenzioso così le mutazioni a monte (pasti/sedute) restano riflesse.
// La chiave composta garantisce di non mostrare mai i dati di un altro atleta o di un altro giorno.
const bioDayVmCache = new Map<string, BioenergeticsDayViewModel>();
function bioDayCacheKey(athleteId: string, date: string): string {
  return `${athleteId}::${date}`;
}

// Link cross-shell (Nutrition/Training): inerte nelle viste scoped admin/coach (v2).
function CrossShellLink({
  adminScoped,
  variant = "primary",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Pro2Link> & { adminScoped: boolean }) {
  if (adminScoped) {
    return (
      <span
        title="Disponibile nella scheda dedicata (v2)"
        className={pro2ButtonClassName(variant, cn(className, "cursor-default opacity-50"))}
      >
        {children}
      </span>
    );
  }
  return (
    <Pro2Link variant={variant} className={className} {...rest}>
      {children}
    </Pro2Link>
  );
}

export default function BioenergeticsPageView() {
  const searchParams = useSearchParams();
  const { athleteId, loading: athleteLoading, adminScoped, role } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vm, setVm] = useState<BioenergeticsDayViewModel | null>(null);
  const seededFromContext = useRef(false);

  useEffect(() => {
    seededFromContext.current = false;
  }, [athleteId]);

  useEffect(() => {
    const fromUrl = coerceIsoDate(searchParams.get("date"));
    if (fromUrl) {
      setDate((d) => (d === fromUrl ? d : fromUrl));
      seededFromContext.current = true;
      return;
    }
    if (!athleteId || athleteLoading) return;
    if (seededFromContext.current) return;
    seededFromContext.current = true;
    const persisted = readPersistedNutritionPlanDate(athleteId);
    if (persisted) setDate((d) => (d === persisted ? d : persisted));
  }, [searchParams, athleteId, athleteLoading]);

  const setDateAndPersist = useCallback(
    (next: string) => {
      const k = coerceIsoDate(next);
      if (!k) return;
      setDate(k);
      if (athleteId) writePersistedNutritionPlanDate(athleteId, k);
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        u.searchParams.set("date", k);
        const qs = u.searchParams.toString();
        window.history.replaceState({}, "", qs ? `${u.pathname}?${qs}${u.hash}` : `${u.pathname}${u.hash}`);
      }
    },
    [athleteId],
  );

  const goToStrip = useCallback(() => {
    if (typeof document === "undefined") return;
    document.getElementById("gen-body")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (athleteLoading) return;
    if (!athleteId) {
      setVm(null);
      setError("Seleziona un atleta attivo per vedere la sua giornata.");
      return;
    }
    let cancelled = false;
    const cacheKey = bioDayCacheKey(athleteId, date);
    const cached = bioDayVmCache.get(cacheKey);
    (async () => {
      if (cached) {
        // Stessa giornata già in cache: mostra subito (niente spinner) e aggiorna in background.
        setVm(cached);
        setError(null);
        setLoading(false);
      } else {
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
        bioDayVmCache.set(cacheKey, vmPayload);
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

  const timelineModelStimuli = useMemo(() => {
    if (!vm?.timeline?.length) return [];
    return [...vm.timeline].filter((e) => TIMELINE_MODEL_TYPES.has(e.type)).sort((a, b) => a.ts.localeCompare(b.ts));
  }, [vm?.timeline]);

  const isToday = date === toIsoDate(new Date());

  return (
    <Pro2ModulePageShell
      eyebrow="La tua giornata, ora per ora"
      eyebrowClassName="text-lime-400"
      title="Bioenergetica"
      description="Una striscia che racconta la tua giornata, dal mattino alla sera. All’inizio è una previsione dal tuo piano di pasti e allenamenti; con il passare delle ore si adatta a ciò che mangi e ti alleni davvero. È una stima orientativa, non un sensore continuo né un referto medico."
    >
      {/* PRIMARY JOB sopra la piega: scegli il giorno e apri la striscia. Una sola CTA primaria. */}
      <section id="gen-domain" className="scroll-mt-28">
        <Pro2SectionCard accent="lime" title="Scegli il giorno" subtitle="Imposta il contesto prima dei numeri" icon={Timer}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDateAndPersist(e.currentTarget.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 sm:w-auto"
                aria-label="Giorno da visualizzare"
              />
              {!isToday ? (
                <button
                  type="button"
                  onClick={() => setDateAndPersist(toIsoDate(new Date()))}
                  className={pro2ButtonClassName("ghost", "justify-center")}
                >
                  Oggi
                </button>
              ) : null}
              <p className="max-w-xl text-xs leading-relaxed text-gray-400">
                Di default vedi il <strong className="text-gray-200">giorno del piano Nutrizione</strong>. Cambiando
                giorno qui si aggiorna anche la Nutrizione e il link da condividere.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={goToStrip}
                className={pro2ButtonClassName("primary", "justify-center")}
                disabled={!vm}
              >
                Vedi la striscia di {formatDayLabel(date)}
              </button>
            </div>
          </div>
        </Pro2SectionCard>
      </section>

      <div className="scroll-mt-28">
        <GenerativeModuleSubnav />
      </div>

      <section id="gen-body" className="scroll-mt-28 space-y-6">
        {error ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p> : null}
        {athleteLoading || loading ? (
          <div className="space-y-2">
            <div className="h-3 w-full max-w-xl animate-pulse rounded bg-white/10" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
          </div>
        ) : null}

        {vm && vm.timeline.length === 0 ? (
          <p className="rounded-xl border border-lime-500/25 bg-lime-500/10 px-4 py-3 text-sm text-lime-100">
            Per <strong className="text-white">{formatDayLabel(vm.date)}</strong> non ci sono ancora eventi: la stima avrà
            meno contesto. Aggiungi pasti in{" "}
            <CrossShellLink adminScoped={adminScoped} href="/nutrition/diary" className="text-lime-200 underline-offset-2 hover:text-white">
              Diario
            </CrossShellLink>{" "}
            e sedute in{" "}
            <CrossShellLink adminScoped={adminScoped} href="/training/calendar" className="text-lime-200 underline-offset-2 hover:text-white">
              Calendario
            </CrossShellLink>
            .
          </p>
        ) : null}

        {vm ? (
          <>
            <Pro2SectionCard
              accent="lime"
              title="Striscia 24 h"
              subtitle="Andamento della giornata, passo 5 min. Quando c’è una misura reale ha sempre la priorità."
              icon={LineChart}
            >
              {vm.continuousMonitoring &&
              (vm.continuousMonitoring.channels.length > 0 || vm.continuousMonitoring.layer === "ai_from_inputs_v1") ? (
                <div className="space-y-4">
                  {vm.continuousMonitoring.channels.length === 0 &&
                  vm.continuousMonitoring.layer === "ai_from_inputs_v1" ? (
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
                <p className="text-sm text-gray-500">Nessun dato striscia per questa giornata.</p>
              )}
            </Pro2SectionCard>

            <Pro2Accordion
              accent="lime"
              title="Metabolismo, infiammazione, ormoni e neuromodulatori"
              subtitle={`Valori stimati dalla giornata · ${vm.metricTiles?.length ?? 0} indicatori`}
            >
              {(() => {
                const tiles = vm.metricTiles ?? [];
                if (!tiles.length) {
                  return <p className="text-sm text-gray-500">Nessun indicatore per questa giornata.</p>;
                }
                const byCat = tiles.reduce<Record<string, BioenergeticMetricTile[]>>((acc, t) => {
                  const k = t.category;
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(t);
                  return acc;
                }, {});
                const order: BioenergeticMetricTileCategory[] = [
                  "metabolic",
                  "inflammatory",
                  "hormonal",
                  "neural",
                  "gastro_intestinal",
                  "gonadal",
                ];
                return (
                  <div className="space-y-6">
                    {order.map((cat) => {
                      const list = byCat[cat];
                      if (!list?.length) return null;
                      return (
                        <div key={cat}>
                          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                            {CATEGORY_LABEL[cat]}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {list.map((t) => (
                              <div
                                key={t.id}
                                className={`rounded-xl border px-3 py-2.5 ${impactTileClass(t.impact)}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 text-xs font-medium leading-snug text-white">{t.labelIt}</p>
                                  <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-gray-300">
                                    {provenanceLabel(t.provenance)}
                                  </span>
                                </div>
                                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
                                  {t.displayValue}
                                  <span className="ml-1 text-xs font-medium text-gray-500">{t.unit}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Pro2Accordion>
          </>
        ) : null}
      </section>

      <section id="gen-focus" className="scroll-mt-28 space-y-6">
        <Pro2SectionCard accent="lime" title="Da tenere a mente" subtitle="Come leggere questi numeri" icon={Activity}>
          {(() => {
            const raw = vm?.disclaimers ?? [];
            const lines = showTech ? raw : athleteDisclaimers(raw);
            const display = lines.length ? lines : ["Nessuna nota disponibile."];
            return (
              <ul className="space-y-2 text-sm text-gray-300">
                {display.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            );
          })()}
        </Pro2SectionCard>

        <Pro2Accordion
          accent="lime"
          title="Dettagli e motore"
          subtitle="Metodologia, contesto usato e diagnostica tecnica"
        >
          <div className="space-y-5 text-sm text-gray-300">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Come nasce la striscia</p>
              <p className="mt-1 leading-relaxed text-gray-400">
                La giornata è ricostruita a passo 5 minuti unendo il piano (pasti e allenamenti previsti) con quello che
                viene registrato davvero nel Diario e nel Calendario. Dove esiste una misura reale (es. glicemia da
                sensore) quella ha sempre la priorità sulla stima. Gli indicatori di metabolismo, ormoni e neuromodulatori
                sono valori orientativi calcolati sugli stessi eventi della giornata.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <CrossShellLink adminScoped={adminScoped} href="/nutrition" variant="secondary" className="justify-center border-amber-500/30 bg-amber-500/10 text-amber-100 hover:border-amber-400/50 hover:bg-amber-500/20">
                Apri Nutrizione
              </CrossShellLink>
              <CrossShellLink adminScoped={adminScoped} href="/training/calendar" variant="secondary" className="justify-center border-sky-500/30 bg-sky-500/10 text-sky-100 hover:border-sky-400/50 hover:bg-sky-500/20">
                Apri Calendario
              </CrossShellLink>
            </div>

            {vm ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Eventi della giornata</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">{vm.timeline.length}</p>
                <p className="mt-1 text-[0.65rem] text-gray-500">
                  Pasti, sedute ed esami usati come contesto del {formatDayLabel(vm.date)}.
                </p>
              </div>
            ) : null}

            {showTech && vm ? (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                  Diagnostica tecnica (coach/admin)
                </p>

                {timelineModelStimuli.length ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                      Contesto inviato (estratto timeline)
                    </p>
                    <ul className="max-h-36 space-y-1.5 overflow-y-auto text-[0.7rem] text-gray-200">
                      {timelineModelStimuli.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                        >
                          <span className="shrink-0 font-mono text-[0.65rem] tabular-nums text-lime-300">{e.ts}</span>
                          <span className="shrink-0 text-gray-500">
                            {e.type === "meal"
                              ? "Pasto"
                              : e.type === "executed_session"
                                ? "Seduta eseguita"
                                : "Seduta pianificata"}
                          </span>
                          <span className="min-w-0 flex-1 text-gray-100">{e.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {vm.planRealityFusionV1 ? (
                  <p className="rounded-xl border border-lime-500/25 bg-lime-500/10 px-3 py-2 text-[0.7rem] leading-relaxed text-lime-100/95">
                    Adattamento da ore{" "}
                    <strong className="text-white">
                      {vm.planRealityFusionV1.adaptFromHour >= 24 ? "— (solo piano)" : vm.planRealityFusionV1.adaptFromHour}
                    </strong>
                    {" · "}
                    piano: {vm.planRealityFusionV1.planSource} ({vm.planRealityFusionV1.plannedMealCount} pasti) · diario:{" "}
                    {vm.planRealityFusionV1.diaryMealCount} · eseguite: {vm.planRealityFusionV1.executedSessionCount}
                  </p>
                ) : null}

                {vm.monitoringStripAuditV1 ? <BioenergeticsStripAuditPanel audit={vm.monitoringStripAuditV1} /> : null}
              </div>
            ) : null}
          </div>
        </Pro2Accordion>
      </section>
    </Pro2ModulePageShell>
  );
}
