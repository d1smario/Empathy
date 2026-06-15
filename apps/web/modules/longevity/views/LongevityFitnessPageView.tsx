"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Award, HeartPulse, Sparkles } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { Pro2Accordion, Pro2Button } from "@/components/ui/empathy";
import { Pro2StickyAnchorSubnav } from "@/components/navigation/Pro2StickyAnchorSubnav";
import { MODULE_PILL_FUCHSIA } from "@/components/navigation/module-pill-styles";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { cn } from "@/lib/cn";
import {
  COIN_PER_EFFICIENT_DAY,
  COIN_TIERS,
  DAILY_CHECKIN_SYMPTOMS,
  EPI_EFFICIENT_DAY_MIN_SCORE,
  type DailyCheckin,
  type DailyCheckinSymptom,
  type EmpathyCoinBalance,
  type EpiPillarId,
  type EpiResult,
} from "@/lib/empathy/schemas";

type LongevityFitnessPayload = {
  epi: EpiResult;
  checkin: DailyCheckin | null;
  balance: EmpathyCoinBalance;
  snapshotDate: string;
};

const SCALES: Array<{ key: keyof CheckinForm; label: string; hint: string }> = [
  { key: "energy", label: "Energia", hint: "1 scarica · 5 al top" },
  { key: "mood", label: "Umore", hint: "1 basso · 5 ottimo" },
  { key: "sleepQuality", label: "Qualità sonno", hint: "1 pessima · 5 eccellente" },
  { key: "motivation", label: "Motivazione", hint: "1 nulla · 5 alta" },
  { key: "soreness", label: "Indolenzimento", hint: "1 nessuno · 5 forte" },
  { key: "stress", label: "Stress", hint: "1 nessuno · 5 forte" },
];

const SYMPTOM_LABELS: Record<DailyCheckinSymptom, string> = {
  fever: "Febbre",
  headache: "Mal di testa",
  sore_throat: "Mal di gola",
  gi_upset: "Disturbi GI",
  cold_flu: "Raffreddore/influenza",
  injury: "Infortunio",
  other: "Altro",
};

const PILLAR_LABELS: Record<EpiPillarId, string> = {
  activity_load: "Carico & attività",
  recovery: "Recupero",
  hrv: "HRV",
  sleep: "Sonno",
  nutrition: "Nutrizione",
  body_composition: "Composizione corporea",
  protocol_adherence: "Aderenza protocolli",
  subjective_wellness: "Benessere soggettivo",
};

const SUBNAV_ITEMS = [
  { id: "long-checkin", label: "Check-in" },
  { id: "long-indice", label: "Indice" },
  { id: "long-coin", label: "Empathy Coin" },
  { id: "long-dettagli", label: "Dettagli e motore" },
];

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

function tierPillClass(tier: EmpathyCoinBalance["tier"]): string {
  if (tier === "gold") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (tier === "silver") return "border-white/15 bg-white/5 text-gray-200";
  if (tier === "bronze") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-white/10 bg-white/5 text-gray-500";
}

function formatSnapshotDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

function ScaleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <span className="text-[0.65rem] text-gray-500">{hint}</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={cn(
              "h-10 flex-1 rounded-xl border text-sm font-bold transition",
              value === n
                ? "border-transparent bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white shadow-lg shadow-fuchsia-500/25"
                : "border-white/15 bg-black/40 text-gray-400 hover:border-fuchsia-500/40 hover:text-white",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LongevityFitnessPageView() {
  const { athleteId, signedIn, adminScoped, role } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  const [data, setData] = useState<LongevityFitnessPayload | null>(null);
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
      setLoading(true);
      setError(null);
      try {
        // In scheda admin niente persistenza snapshot/coin: la sola apertura non muta lo storico
        const persistParam = adminScoped ? "&persist=false" : "";
        const res = await fetch(`/api/longevity/index?athleteId=${encodeURIComponent(id)}${persistParam}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as LongevityFitnessPayload & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Errore caricamento");
        setData(json);
        hydrateFromCheckin(json.checkin);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore caricamento");
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
    if (!athleteId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/longevity/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...form, illnessFlags: symptoms, note }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Errore salvataggio");
      await loadIndex(athleteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }, [athleteId, form, symptoms, note, loadIndex]);

  const epi = data?.epi ?? null;
  const balance = data?.balance ?? null;

  const pillars = useMemo(() => (epi?.pillars ?? []).filter((p) => p.available), [epi]);

  return (
    <Pro2ModulePageShell
      eyebrow="Benessere quotidiano"
      eyebrowClassName={moduleEyebrowClass("longevity")}
      title="Longevità"
      description="Fai il check-in di oggi e segui il tuo indice: ogni giorno efficiente vale Empathy Coin verso Bronze, Silver e Gold."
    >
      <Pro2AthleteRequiredGate enabled={signedIn}>
        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        <Pro2StickyAnchorSubnav items={SUBNAV_ITEMS} accent={MODULE_PILL_FUCHSIA} />

        <section id="long-checkin" className="scroll-mt-28">
          <Pro2SectionCard accent="fuchsia" title="Check-in di oggi" subtitle="Come ti senti · segnala eventuali malesseri" icon={Activity}>
            <div className="grid gap-4 sm:grid-cols-2">
              {SCALES.map((s) => (
                <ScaleRow
                  key={s.key}
                  label={s.label}
                  hint={s.hint}
                  value={form[s.key]}
                  onChange={(v) => setForm((prev) => ({ ...prev, [s.key]: v }))}
                />
              ))}
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-gray-400">Malessere (opzionale)</p>
              <div className="flex flex-wrap gap-2">
                {DAILY_CHECKIN_SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    aria-pressed={symptoms.includes(s)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      symptoms.includes(s)
                        ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                        : "border-white/15 bg-black/30 text-gray-400 hover:border-amber-500/40 hover:text-amber-100",
                    )}
                  >
                    {SYMPTOM_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="longevity-note" className="mb-1.5 block text-xs font-medium text-gray-400">
                Nota (opzionale)
              </label>
              <textarea
                id="longevity-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="Es. notte agitata, dolore al ginocchio…"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="mt-5 flex justify-end">
              <Pro2Button onClick={saveCheckin} disabled={saving || !athleteId}>
                {saving ? "Salvataggio…" : "Salva check-in"}
              </Pro2Button>
            </div>
          </Pro2SectionCard>
        </section>

        <section id="long-indice" className="scroll-mt-28">
          <Pro2SectionCard accent="fuchsia" title="Indice Longevità & Fitness" subtitle="Calcolato dai tuoi dati reali e dal check-in" icon={HeartPulse}>
            {loading && !epi ? (
              <p className="text-sm text-gray-400">Calcolo in corso…</p>
            ) : epi ? (
              <div className="space-y-5">
                {data?.snapshotDate ? (
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                    Oggi · {formatSnapshotDate(data.snapshotDate)}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <div>
                    <span className="font-mono text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">
                      {Math.round(epi.score)}
                    </span>
                    <span className="ml-1 text-xs font-medium text-gray-500">/100</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {showTech ? (
                      <p>Confidenza {Math.round(epi.confidence * 100)}% · copertura {epi.dataTier}</p>
                    ) : null}
                    <p className="mt-1">
                      {epi.efficientDay ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-emerald-300">
                          Giorno efficiente · +{epi.coinAwardForDay} Coin
                        </span>
                      ) : epi.illnessDay ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
                          Giorno di malessere · obiettivo sospeso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">
                          Giorno non ancora efficiente
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {epi.illnessDay ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                    Hai segnalato un malessere: nessuna penalità sull&apos;indice e nessun Coin perso. Priorità al recupero.
                  </div>
                ) : null}

                <div className="space-y-2.5">
                  {pillars.map((p) => (
                    <div key={p.pillar} className="flex items-center gap-3">
                      <span className="w-44 shrink-0 text-xs text-gray-400">{PILLAR_LABELS[p.pillar]}</span>
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
                      Nessun segnale ancora disponibile. Compila il check-in e collega un device per alimentare l&apos;indice.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Indice non disponibile.</p>
            )}
          </Pro2SectionCard>
        </section>

        <section id="long-coin" className="scroll-mt-28">
          <Pro2SectionCard accent="fuchsia" title="Empathy Coin" subtitle="Certificazione Bronze · Silver · Gold" icon={Award}>
            {balance ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <div>
                    <span className="font-mono text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">
                      {balance.totalCoins.toLocaleString("it-IT")}
                    </span>
                    <span className="ml-1 text-xs font-medium text-gray-500">Coin</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase",
                      tierPillClass(balance.tier),
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {balance.tier ?? "Nessun tier"}
                  </span>
                  <span className="text-xs text-gray-500">{balance.efficientDays} giorni efficienti</span>
                </div>

                {balance.nextTier ? (
                  <div>
                    <div className="mb-1 flex justify-between font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                      <span>Verso {balance.nextTier.next}</span>
                      <span>Obiettivo {COIN_TIERS[balance.nextTier.next].toLocaleString("it-IT")} Coin</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-400"
                        style={{
                          width: `${Math.min(100, Math.round((balance.totalCoins / COIN_TIERS[balance.nextTier.next]) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Mancano {balance.nextTier.remaining.toLocaleString("it-IT")} Coin a {balance.nextTier.next}.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-200">Hai raggiunto il livello massimo: Gold.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Saldo non disponibile.</p>
            )}
          </Pro2SectionCard>
        </section>

        <Pro2Accordion
          id="long-dettagli"
          title="Dettagli e motore"
          subtitle="Come nasce l'indice e come guadagni i Coin"
          accent="fuchsia"
        >
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              L&apos;indice (0–100) è calcolato in modo deterministico dai tuoi dati reali e dal check-in giornaliero,
              combinando otto pilastri: carico &amp; attività, recupero, HRV, sonno, nutrizione, composizione corporea,
              aderenza ai protocolli e benessere soggettivo. Solo i pilastri con dati disponibili entrano nel calcolo;
              l&apos;AI aiuta a interpretare i numeri, non li produce.
            </p>
            <p>
              Giorno efficiente: quando l&apos;indice raggiunge almeno {EPI_EFFICIENT_DAY_MIN_SCORE} punti la giornata
              vale {COIN_PER_EFFICIENT_DAY} Empathy Coin. Se nel check-in segnali un malessere, l&apos;obiettivo del
              giorno è sospeso: nessuna penalità e nessun Coin perso.
            </p>
            <p>
              Livelli di certificazione: Bronze a {COIN_TIERS.bronze.toLocaleString("it-IT")} Coin, Silver a{" "}
              {COIN_TIERS.silver.toLocaleString("it-IT")}, Gold a {COIN_TIERS.gold.toLocaleString("it-IT")}.
            </p>
            {epi ? (
              <p className="text-xs text-gray-400">
                Affidabilità del calcolo di oggi: {Math.round(epi.confidence * 100)}% — cresce man mano che colleghi più
                fonti dati (device, sonno, nutrizione).
              </p>
            ) : null}
            {showTech && epi ? (
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-gray-400">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Diagnostica (coach/admin)</p>
                <p className="mt-1">
                  versione {epi.algorithmVersion} · tier dati {epi.dataTier} · confidenza {epi.confidence.toFixed(2)} ·
                  snapshot {data?.snapshotDate ?? "—"}
                </p>
                {epi.provenance.pillarsMissing.length ? (
                  <p className="mt-1">
                    Pilastri mancanti: {epi.provenance.pillarsMissing.map((p) => PILLAR_LABELS[p]).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Pro2Accordion>
      </Pro2AthleteRequiredGate>
    </Pro2ModulePageShell>
  );
}
