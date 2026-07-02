"use client";

/**
 * Pannelli Longevità & Fitness montati nella dashboard (e riusati dalla pagina
 * /longevity). Self-contained: gestisce fetch dell'indice EPI, stato del
 * check-in, salvataggio e cache cross-mount. Rende SOLO le due Pro2SectionCard
 * ("Check-in di oggi" + "Indice Longevità & Fitness"), una sotto l'altra —
 * nessuna shell/subnav/anchor: quelle restano responsabilità del chiamante.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

// I label/hint di ScaleRow, gli SYMPTOM_LABELS e i PILLAR_LABELS sono stringhe
// visibili: le chiavi i18n vengono risolte a runtime dentro il componente, così
// restano localizzate. Qui teniamo solo la mappatura chiave-di-dominio → chiave-i18n.
const SCALE_KEYS: Array<{ key: keyof CheckinForm; labelKey: string; hintKey: string }> = [
  { key: "energy", labelKey: "scaleEnergyLabel", hintKey: "scaleEnergyHint" },
  { key: "mood", labelKey: "scaleMoodLabel", hintKey: "scaleMoodHint" },
  { key: "sleepQuality", labelKey: "scaleSleepQualityLabel", hintKey: "scaleSleepQualityHint" },
  { key: "motivation", labelKey: "scaleMotivationLabel", hintKey: "scaleMotivationHint" },
  { key: "soreness", labelKey: "scaleSorenessLabel", hintKey: "scaleSorenessHint" },
  { key: "stress", labelKey: "scaleStressLabel", hintKey: "scaleStressHint" },
];

const SYMPTOM_LABEL_KEYS: Record<DailyCheckinSymptom, string> = {
  fever: "symptomFever",
  headache: "symptomHeadache",
  sore_throat: "symptomSoreThroat",
  gi_upset: "symptomGiUpset",
  cold_flu: "symptomColdFlu",
  injury: "symptomInjury",
  other: "symptomOther",
};

const PILLAR_LABEL_KEYS: Record<EpiPillarId, string> = {
  activity_load: "pillarActivityLoad",
  recovery: "pillarRecovery",
  hrv: "pillarHrv",
  sleep: "pillarSleep",
  nutrition: "pillarNutrition",
  body_composition: "pillarBodyComposition",
  protocol_adherence: "pillarProtocolAdherence",
  subjective_wellness: "pillarSubjectiveWellness",
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
  const t = useTranslations("DashboardLongevityPanels");
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
        if (!res.ok) throw new Error(json.error ?? t("loadingError"));
        setData(json);
        hydrateFromCheckin(json.checkin);
        writeLongevityCache(cacheKey, json);
      } catch (err) {
        // Con cache già mostrata teniamo i dati validi a schermo: il banner
        // d'errore avviserebbe a vuoto su un refresh di sfondo fallito.
        if (!cached) setError(err instanceof Error ? err.message : t("loadingError"));
      } finally {
        setLoading(false);
      }
    },
    [hydrateFromCheckin, adminScoped, t],
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
      if (!res.ok) throw new Error(json.error ?? t("saveError"));
      await loadIndex(athleteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }, [athleteId, scoped, form, symptoms, note, loadIndex, t]);

  const epi = data?.epi ?? null;

  const pillars = useMemo(() => (epi?.pillars ?? []).filter((p) => p.available), [epi]);

  return (
    <div className="space-y-10">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <Pro2SectionCard
        accent="fuchsia"
        title={t("checkinTitle")}
        subtitle={scoped ? t("checkinSubtitleScoped") : t("checkinSubtitleSelf")}
        icon={Activity}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {SCALE_KEYS.map((s) => (
            <ScaleRow
              key={s.key}
              label={t(s.labelKey)}
              hint={t(s.hintKey)}
              value={form[s.key]}
              onChange={(v) => setForm((prev) => ({ ...prev, [s.key]: v }))}
              readOnly={scoped}
            />
          ))}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-gray-400">{t("symptomsLabel")}</p>
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
                {t(SYMPTOM_LABEL_KEYS[s])}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="longevity-note" className="mb-1.5 block text-xs font-medium text-gray-400">
            {t("noteLabel")}
          </label>
          <textarea
            id="longevity-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            readOnly={scoped}
            rows={2}
            placeholder={scoped ? t("notePlaceholderScoped") : t("notePlaceholderSelf")}
            className={cn(
              "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500",
              scoped ? "cursor-default opacity-80" : "focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500",
            )}
          />
        </div>

        {scoped ? (
          <p className="mt-5 text-xs text-gray-500">{t("scopedReadOnlyNote")}</p>
        ) : (
          <div className="mt-5 flex justify-end">
            <Pro2Button onClick={saveCheckin} disabled={saving || !athleteId}>
              {saving ? t("saving") : t("saveCheckin")}
            </Pro2Button>
          </div>
        )}
      </Pro2SectionCard>

      <Pro2SectionCard accent="fuchsia" title={t("indexTitle")} subtitle={t("indexSubtitle")} icon={HeartPulse}>
        {loading && !epi ? (
          <p className="text-sm text-gray-400">{t("calculating")}</p>
        ) : epi && (epi.dataTier === "standard" || epi.dataTier === "extended") ? (
          <div className="space-y-5">
            {data?.snapshotDate ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                {t("todayPrefix", { date: formatSnapshotDate(data.snapshotDate) })}
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
                  <p>{t("confidenceCoverage", { confidence: Math.round(epi.confidence * 100), coverage: epi.dataTier })}</p>
                ) : null}
                <p className="mt-1">
                  {epi.efficientDay ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-emerald-300">
                      {t("efficientDay")}
                    </span>
                  ) : epi.illnessDay ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
                      {t("symptomDay")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">
                      {t("notEfficientDayYet")}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {epi.illnessDay ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                {t("illnessBanner")}
              </div>
            ) : null}

            <div className="space-y-2.5">
              {pillars.map((p) => (
                <div key={p.pillar} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-gray-400 sm:w-44">{t(PILLAR_LABEL_KEYS[p.pillar])}</span>
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
                  {t("noSignal")}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-gray-300">{t("indexNotAvailable")}</p>
            <p className="text-xs text-gray-500">
              {t("indexNotAvailableHint")}
            </p>
          </div>
        )}
      </Pro2SectionCard>
    </div>
  );
}
