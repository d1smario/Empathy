"use client";

/**
 * Pannelli Longevità & Fitness montati nella dashboard (e riusati dalla pagina
 * /longevity). Self-contained: gestisce fetch dell'indice EPI, stato del
 * check-in, salvataggio e cache cross-mount. Rende SOLO le due Pro2SectionCard
 * ("Check-in di oggi" + "Indice Longevità & Fitness"), una sotto l'altra —
 * nessuna shell/subnav/anchor: quelle restano responsabilità del chiamante.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, HeartPulse } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import {
  DAILY_CHECKIN_SYMPTOMS,
  type DailyCheckin,
  type DailyCheckinSymptom,
  type EpiPillarId,
  type EpiResult,
} from "@/lib/empathy/schemas";

type LongevityFitnessPayload = {
  epi: EpiResult;
  checkin: DailyCheckin | null;
  snapshotDate: string;
};

const SCALES: Array<{ key: keyof CheckinForm; label: string; hint: string }> = [
  { key: "energy", label: "Energy", hint: "1 drained · 5 peak" },
  { key: "mood", label: "Mood", hint: "1 low · 5 great" },
  { key: "sleepQuality", label: "Sleep quality", hint: "1 poor · 5 excellent" },
  { key: "motivation", label: "Motivation", hint: "1 none · 5 high" },
  { key: "soreness", label: "Soreness", hint: "1 none · 5 severe" },
  { key: "stress", label: "Stress", hint: "1 none · 5 severe" },
];

const SYMPTOM_LABELS: Record<DailyCheckinSymptom, string> = {
  fever: "Fever",
  headache: "Headache",
  sore_throat: "Sore throat",
  gi_upset: "GI upset",
  cold_flu: "Cold/flu",
  injury: "Injury",
  other: "Other",
};

const PILLAR_LABELS: Record<EpiPillarId, string> = {
  activity_load: "Load & activity",
  recovery: "Recovery",
  hrv: "HRV",
  sleep: "Sleep",
  nutrition: "Nutrition",
  body_composition: "Body composition",
  protocol_adherence: "Protocol adherence",
  subjective_wellness: "Subjective wellness",
};

type CheckinForm = {
  energy: number | null;
  mood: number | null;
  sleepQuality: number | null;
  motivation: number | null;
  soreness: number | null;
  stress: number | null;
};

const EMPTY_FORM: CheckinForm = {
  energy: null,
  mood: null,
  sleepQuality: null,
  motivation: null,
  soreness: null,
  stress: null,
};

// Cache cross-mount dell'indice longevità: ri-atterrando sui pannelli i dati
// compaiono subito (niente spinner "Calcolo in corso…"); il refetch avviene in
// background silenzioso, così i nuovi check-in salvati restano comunque riflessi.
// La chiave include adminScoped perché la scheda admin non persiste lo snapshot
// (persist=false): non mescoliamo mai dati di scope/atleti diversi.
const LONGEVITY_SS_PREFIX = "longevity-index:";
const longevityIndexCache = new Map<string, LongevityFitnessPayload>();
function longevityCacheKey(id: string, adminScoped: boolean): string {
  return `${id}::${adminScoped ? "admin" : "self"}`;
}
function readLongevityCache(key: string): LongevityFitnessPayload | null {
  const mem = longevityIndexCache.get(key);
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LONGEVITY_SS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LongevityFitnessPayload;
    if (parsed) {
      longevityIndexCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // sessionStorage non disponibile / JSON corrotto: ignora.
  }
  return null;
}
function writeLongevityCache(key: string, payload: LongevityFitnessPayload): void {
  longevityIndexCache.set(key, payload);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LONGEVITY_SS_PREFIX + key, JSON.stringify(payload));
  } catch {
    // quota/serializzazione: la cache in-memory basta comunque.
  }
}

function formatSnapshotDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
}

function ScaleRow({
  label,
  hint,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <span className="text-[0.65rem] text-gray-500">{hint}</span>
      </div>
      <div className="flex gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={readOnly ? undefined : () => onChange(n)}
            disabled={readOnly}
            aria-pressed={value === n}
            className={cn(
              "h-10 min-w-0 flex-1 rounded-xl border text-sm font-bold transition",
              value === n
                ? "border-transparent bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white shadow-lg shadow-fuchsia-500/25"
                : "border-white/15 bg-black/40 text-gray-400",
              readOnly ? "cursor-default opacity-80" : value === n ? "" : "hover:border-fuchsia-500/40 hover:text-white",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DashboardLongevityPanels() {
  const { athleteId, adminScoped, role } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  // In scope coach/admin (adminScoped) il check-in è in SOLA LETTURA: è un dato
  // soggettivo dell'atleta, lo staff lo consulta ma non lo registra al suo posto
  // (eviterebbe di falsare l'attribuzione self_report e l'indice EPI).
  const scoped = adminScoped;
  const [data, setData] = useState<LongevityFitnessPayload | null>(() =>
    athleteId ? readLongevityCache(longevityCacheKey(athleteId, adminScoped)) : null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CheckinForm>(EMPTY_FORM);
  const [symptoms, setSymptoms] = useState<DailyCheckinSymptom[]>([]);
  const [note, setNote] = useState("");

  const hydrateFromCheckin = useCallback((checkin: DailyCheckin | null) => {
    setForm({
      energy: checkin?.energy ?? null,
      mood: checkin?.mood ?? null,
      sleepQuality: checkin?.sleepQuality ?? null,
      motivation: checkin?.motivation ?? null,
      soreness: checkin?.soreness ?? null,
      stress: checkin?.stress ?? null,
    });
    setSymptoms(checkin?.illnessFlags ?? []);
    setNote(checkin?.note ?? "");
  }, []);

  const loadIndex = useCallback(
    async (id: string) => {
      const cacheKey = longevityCacheKey(id, adminScoped);
      // Se i dati di questa stessa chiave sono già in cache, mostrali SUBITO
      // (niente spinner "Calcolo in corso…"); il refetch in background sotto
      // aggiorna comunque stato+cache, così i nuovi check-in restano riflessi.
      const cached = readLongevityCache(cacheKey);
      if (cached) {
        setData(cached);
        hydrateFromCheckin(cached.checkin);
        setError(null);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        // In scheda admin niente persistenza snapshot/coin: la sola apertura non muta lo storico
        const persistParam = adminScoped ? "&persist=false" : "";
        const res = await fetch(`/api/longevity/index?athleteId=${encodeURIComponent(id)}${persistParam}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as LongevityFitnessPayload & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Loading error");
        setData(json);
        hydrateFromCheckin(json.checkin);
        writeLongevityCache(cacheKey, json);
      } catch (err) {
        // Con cache già mostrata teniamo i dati validi a schermo: il banner
        // d'errore avviserebbe a vuoto su un refresh di sfondo fallito.
        if (!cached) setError(err instanceof Error ? err.message : "Loading error");
      } finally {
        setLoading(false);
      }
    },
    [hydrateFromCheckin, adminScoped],
  );

  useEffect(() => {
    if (athleteId) void loadIndex(athleteId);
  }, [athleteId, loadIndex]);

  const toggleSymptom = useCallback((s: DailyCheckinSymptom) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  const saveCheckin = useCallback(async () => {
    if (!athleteId || scoped) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/longevity/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...form, illnessFlags: symptoms, note }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save error");
      await loadIndex(athleteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save error");
    } finally {
      setSaving(false);
    }
  }, [athleteId, scoped, form, symptoms, note, loadIndex]);

  const epi = data?.epi ?? null;

  const pillars = useMemo(() => (epi?.pillars ?? []).filter((p) => p.available), [epi]);

  return (
    <div className="space-y-10">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <Pro2SectionCard
        accent="fuchsia"
        title="Today's check-in"
        subtitle={scoped ? "How the athlete feels · read only" : "How you feel · flag any symptoms"}
        icon={Activity}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {SCALES.map((s) => (
            <ScaleRow
              key={s.key}
              label={s.label}
              hint={s.hint}
              value={form[s.key]}
              onChange={(v) => setForm((prev) => ({ ...prev, [s.key]: v }))}
              readOnly={scoped}
            />
          ))}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-gray-400">Symptoms (optional)</p>
          <div className="flex flex-wrap gap-2">
            {DAILY_CHECKIN_SYMPTOMS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={scoped ? undefined : () => toggleSymptom(s)}
                disabled={scoped}
                aria-pressed={symptoms.includes(s)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  symptoms.includes(s)
                    ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                    : "border-white/15 bg-black/30 text-gray-400",
                  scoped
                    ? "cursor-default opacity-80"
                    : symptoms.includes(s)
                      ? ""
                      : "hover:border-amber-500/40 hover:text-amber-100",
                )}
              >
                {SYMPTOM_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="longevity-note" className="mb-1.5 block text-xs font-medium text-gray-400">
            Note (optional)
          </label>
          <textarea
            id="longevity-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            readOnly={scoped}
            rows={2}
            placeholder={scoped ? "No note" : "E.g. restless night, knee pain…"}
            className={cn(
              "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500",
              scoped ? "cursor-default opacity-80" : "focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500",
            )}
          />
        </div>

        {scoped ? (
          <p className="mt-5 text-xs text-gray-500">The check-in is the athlete&apos;s own subjective input: you review it, you don&apos;t log it on their behalf.</p>
        ) : (
          <div className="mt-5 flex justify-end">
            <Pro2Button onClick={saveCheckin} disabled={saving || !athleteId}>
              {saving ? "Saving…" : "Save check-in"}
            </Pro2Button>
          </div>
        )}
      </Pro2SectionCard>

      <Pro2SectionCard accent="fuchsia" title="Longevity & Fitness Index" subtitle="Computed from your real data and the check-in" icon={HeartPulse}>
        {loading && !epi ? (
          <p className="text-sm text-gray-400">Calculating…</p>
        ) : epi && (epi.dataTier === "standard" || epi.dataTier === "extended") ? (
          <div className="space-y-5">
            {data?.snapshotDate ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                Today · {formatSnapshotDate(data.snapshotDate)}
              </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 sm:gap-x-6">
              <div>
                <span className="font-mono text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">
                  {Math.round(epi.score)}
                </span>
                <span className="ml-1 text-xs font-medium text-gray-500">/100</span>
              </div>
              <div className="text-xs text-gray-400">
                {showTech ? (
                  <p>Confidence {Math.round(epi.confidence * 100)}% · coverage {epi.dataTier}</p>
                ) : null}
                <p className="mt-1">
                  {epi.efficientDay ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-emerald-300">
                      Efficient day
                    </span>
                  ) : epi.illnessDay ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
                      Symptom day · goal suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">
                      Not an efficient day yet
                    </span>
                  )}
                </p>
              </div>
            </div>

            {epi.illnessDay ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                You flagged a symptom: no penalty on the index, recovery comes first.
              </div>
            ) : null}

            <div className="space-y-2.5">
              {pillars.map((p) => (
                <div key={p.pillar} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-gray-400 sm:w-44">{PILLAR_LABELS[p.pillar]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-400"
                      style={{ width: `${Math.round(p.score ?? 0)}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-white">
                    {Math.round(p.score ?? 0)}
                  </span>
                </div>
              ))}
              {!pillars.length ? (
                <p className="text-xs text-gray-500">
                  No signal available yet. Fill in the check-in and connect a device to feed the index.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-gray-300">Index not available yet.</p>
            <p className="text-xs text-gray-500">
              Real data is required: complete today&apos;s check-in above and connect a device (sleep, recovery, HRV) to
              compute the index. While coverage stays minimal we don&apos;t show an estimated score.
            </p>
          </div>
        )}
      </Pro2SectionCard>
    </div>
  );
}
