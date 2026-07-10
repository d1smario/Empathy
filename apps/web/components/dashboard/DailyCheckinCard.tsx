"use client";

/**
 * «Check-in di oggi» — card standalone estratta da DashboardLongevityPanels e
 * montata nella vista «Oggi» (atleta /today, mobile /m/today e scope coach/admin,
 * che montano la stessa TodayPageView): il check-in mattutino è la prima azione
 * della giornata, non un pannello di analisi.
 *
 * Dati: GET /api/longevity/checkin (solo check-in, senza calcolo EPI) per idratare;
 * POST /api/longevity/checkin per salvare — il POST alimenta comunque il pilastro
 * subjective_wellness dell'indice EPI in «Analisi» (che rifetcha in background).
 * In scope coach/admin è in SOLA LETTURA: dato soggettivo dell'atleta, lo staff lo
 * consulta ma non lo registra al posto suo. i18n: namespace DashboardLongevityPanels
 * (stesse chiavi della card originale).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import {
  DAILY_CHECKIN_SYMPTOMS,
  type DailyCheckin,
  type DailyCheckinSymptom,
} from "@/lib/empathy/schemas";

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

export function DailyCheckinCard({ athleteId: athleteIdProp }: { athleteId?: string | null }) {
  const t = useTranslations("DashboardLongevityPanels");
  const { athleteId: athleteIdCtx, adminScoped } = useActiveAthlete();
  const athleteId = athleteIdProp ?? athleteIdCtx;
  // In scope coach/admin il check-in è in SOLA LETTURA: dato soggettivo dell'atleta.
  const scoped = adminScoped;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
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

  useEffect(() => {
    if (!athleteId) return;
    let c = false;
    (async () => {
      try {
        const res = await fetch(`/api/longevity/checkin?athleteId=${encodeURIComponent(athleteId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { checkin?: DailyCheckin | null; error?: string };
        if (c) return;
        if (!res.ok) throw new Error(json.error ?? t("loadingError"));
        hydrateFromCheckin(json.checkin ?? null);
        setError(null);
      } catch (err) {
        if (!c) setError(err instanceof Error ? err.message : t("loadingError"));
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, hydrateFromCheckin, t]);

  const toggleSymptom = useCallback((s: DailyCheckinSymptom) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  const saveCheckin = useCallback(async () => {
    if (!athleteId || scoped) return;
    setSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      const res = await fetch("/api/longevity/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...form, illnessFlags: symptoms, note }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? t("saveError"));
      setSavedOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }, [athleteId, scoped, form, symptoms, note, t]);

  if (!athleteId) return null;

  return (
    <Pro2SectionCard
      accent="fuchsia"
      title={t("checkinTitle")}
      subtitle={scoped ? t("checkinSubtitleScoped") : t("checkinSubtitleSelf")}
      icon={Activity}
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

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
        <label htmlFor="daily-checkin-note" className="mb-1.5 block text-xs font-medium text-gray-400">
          {t("noteLabel")}
        </label>
        <textarea
          id="daily-checkin-note"
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
        <div className="mt-5 flex items-center justify-end gap-3">
          {savedOk ? <span className="text-xs font-semibold text-emerald-300">{t("checkinSavedOk")}</span> : null}
          <Pro2Button onClick={saveCheckin} disabled={saving || !athleteId}>
            {saving ? t("saving") : t("saveCheckin")}
          </Pro2Button>
        </div>
      )}
    </Pro2SectionCard>
  );
}
