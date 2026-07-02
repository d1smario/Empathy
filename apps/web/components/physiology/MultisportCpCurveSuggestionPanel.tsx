"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { MultisportCpCurveSuggestionMode, MultisportCpCurveSuggestionOutput } from "@/lib/engines/multisport-cp-curve-suggestion";
import { MULTISPORT_CP_CURVE_LABELS } from "@/lib/engines/multisport-cp-curve-suggestion";
import type { MultisportEngineSport } from "@/lib/engines/multisport-energy-engine";
import { Pro2Button } from "@/components/ui/empathy";

const SPORTS: { id: MultisportEngineSport; label: string }[] = [
  { id: "cycling", label: "Cycling" },
  { id: "running", label: "Running" },
  { id: "swimming", label: "Swimming" },
  { id: "xc_ski", label: "Cross-country skiing" },
  { id: "ski_alpine", label: "Alpine skiing" },
  { id: "soccer", label: "Soccer" },
  { id: "team_court", label: "Team (field / court)" },
];

const MODES: { id: MultisportCpCurveSuggestionMode; label: string; hint: string }[] = [
  {
    id: "cycling_power_anchors",
    label: "Cycling · power anchors",
    hint: "At least 2 duration (s) / W pairs from a test or file.",
  },
  {
    id: "running_race_riegel",
    label: "Running / field · race (Riegel)",
    hint: "Distance (m) and time (s) — even a single race.",
  },
  {
    id: "swimming_pace_riegel",
    label: "Swimming · pace (Riegel)",
    hint: "Same race scheme; cubic-drag estimator.",
  },
  {
    id: "velocity_sport_riegel",
    label: "Skiing · race / pace (Riegel)",
    hint: "Uses distance/time; velocity model + optional grade.",
  },
  {
    id: "reference_w_phenotype",
    label: "Reference W + phenotype",
    hint: "A single equivalent W (threshold-type) and template curve shape.",
  },
];

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type MultisportCpCurveSuggestionPanelProps = {
  athleteId: string;
  bodyMassKg: number;
  /** Dopo aver riempito i campi CP in anteprima (non salva Supabase). */
  onApplyToCpInputs: (wByLabel: Partial<Record<string, number>>) => void;
  onAfterApply?: () => void;
  /** Persistenza Supabase dopo anteprima (stesso snapshot Metabolic profile). */
  onSaveMetabolicProfile?: () => void;
  metabolicProfileSaveDisabled?: boolean;
  metabolicProfileSaveLabel?: string;
};

export function MultisportCpCurveSuggestionPanel({
  athleteId,
  bodyMassKg,
  onApplyToCpInputs,
  onAfterApply,
  onSaveMetabolicProfile,
  metabolicProfileSaveDisabled = false,
  metabolicProfileSaveLabel = "Save metabolic profile",
}: MultisportCpCurveSuggestionPanelProps) {
  const t = useTranslations("MultisportCpCurveSuggestionPanel");
  const [sport, setSport] = useState<MultisportEngineSport>("running");
  const [mode, setMode] = useState<MultisportCpCurveSuggestionMode>("running_race_riegel");
  const [efficiencyStr, setEfficiencyStr] = useState("0.24");
  const [gradePctStr, setGradePctStr] = useState("0");

  const [cD1, setCD1] = useState("300");
  const [cP1, setCP1] = useState("280");
  const [cD2, setCD2] = useState("1200");
  const [cP2, setCP2] = useState("220");

  const [raceD1, setRaceD1] = useState("5000");
  const [raceT1, setRaceT1] = useState("1200");
  const [raceD2, setRaceD2] = useState("");
  const [raceT2, setRaceT2] = useState("");

  const [refW, setRefW] = useState("240");
  const [phenotype, setPhenotype] = useState<"oxidative" | "balanced" | "glycolytic">("balanced");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<MultisportCpCurveSuggestionOutput | null>(null);

  const massOk = useMemo(() => bodyMassKg >= 35 && bodyMassKg <= 120, [bodyMassKg]);

  const buildRequestBody = useCallback(() => {
    const efficiency = parseNum(efficiencyStr);
    const gradePct = parseNum(gradePctStr);
    const gradeFraction = gradePct != null ? gradePct / 100 : undefined;

    const effectiveSport: MultisportEngineSport =
      mode === "swimming_pace_riegel" ? "swimming" : mode === "cycling_power_anchors" ? "cycling" : sport;

    const base = {
      athleteId,
      sport: effectiveSport,
      bodyMassKg,
      mode,
      efficiency: efficiency ?? undefined,
      gradeFraction,
    };

    if (mode === "cycling_power_anchors") {
      const d1 = parseNum(cD1);
      const p1 = parseNum(cP1);
      const d2 = parseNum(cD2);
      const p2 = parseNum(cP2);
      const powerAnchors = [
        ...(d1 != null && p1 != null && d1 > 0 && p1 > 0 ? [{ durationSec: d1, powerW: p1 }] : []),
        ...(d2 != null && p2 != null && d2 > 0 && p2 > 0 ? [{ durationSec: d2, powerW: p2 }] : []),
      ];
      return { ...base, sport: "cycling" as const, powerAnchors };
    }

    if (mode === "reference_w_phenotype") {
      const rw = parseNum(refW);
      return { ...base, referenceWatts: rw ?? undefined, phenotype };
    }

    const rd1 = parseNum(raceD1);
    const rt1 = parseNum(raceT1);
    const rd2 = parseNum(raceD2);
    const rt2 = parseNum(raceT2);
    const raceAnchors = [
      ...(rd1 != null && rt1 != null && rd1 > 0 && rt1 > 0 ? [{ distanceM: rd1, timeSec: rt1 }] : []),
      ...(rd2 != null && rt2 != null && rd2 > 0 && rt2 > 0 ? [{ distanceM: rd2, timeSec: rt2 }] : []),
    ];
    return { ...base, raceAnchors };
  }, [
    athleteId,
    sport,
    bodyMassKg,
    mode,
    efficiencyStr,
    gradePctStr,
    cD1,
    cP1,
    cD2,
    cP2,
    raceD1,
    raceT1,
    raceD2,
    raceT2,
    refW,
    phenotype,
  ]);

  const runSuggest = useCallback(async () => {
    setErr(null);
    setResult(null);
    if (!massOk) {
      setErr(t("errInvalidWeight"));
      return;
    }
    setLoading(true);
    try {
      const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/physiology/multisport-cp-curve", {
        method: "POST",
        headers,
        body: JSON.stringify(buildRequestBody()),
      });
      const json = (await res.json().catch(() => ({}))) as MultisportCpCurveSuggestionOutput & { error?: string };
      if (!res.ok) {
        setErr(json.error ?? t("errHttp", { status: res.status }));
        return;
      }
      if (json.error) {
        setErr(json.error);
        return;
      }
      setResult(json as MultisportCpCurveSuggestionOutput);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("errNetwork"));
    } finally {
      setLoading(false);
    }
  }, [buildRequestBody, massOk]);

  const applyPreview = useCallback(() => {
    if (!result?.cpCurveInputsW) return;
    const out: Partial<Record<string, number>> = {};
    for (const label of MULTISPORT_CP_CURVE_LABELS) {
      const w = result.cpCurveInputsW[label];
      if (typeof w === "number" && w > 0) out[label] = w;
    }
    if (Object.keys(out).length === 0) {
      setErr(t("errNoWPoint"));
      return;
    }
    onApplyToCpInputs(out);
    onAfterApply?.();
    setErr(null);
  }, [result, onApplyToCpInputs, onAfterApply]);

  const modeMeta = MODES.find((m) => m.id === mode);

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/[0.14] via-black/40 to-black/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{t("title")}</h3>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-gray-500">
            {t.rich("description", {
              code: (chunks) => <code className="text-gray-400">{chunks}</code>,
              strong: (chunks) => <strong className="text-gray-300">{chunks}</strong>,
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          {t("sportLabel")}
          <select
            className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-gray-200"
            value={sport}
            onChange={(e) => setSport(e.target.value as MultisportEngineSport)}
          >
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400 sm:col-span-2">
          {t("modeLabel")}
          <select
            className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-gray-200"
            value={mode}
            onChange={(e) => setMode(e.target.value as MultisportCpCurveSuggestionMode)}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          {t("efficiencyLabel")}
          <input
            className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-gray-200"
            value={efficiencyStr}
            onChange={(e) => setEfficiencyStr(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          {t("gradeLabel")}
          <input
            className="rounded-xl border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-gray-200"
            value={gradePctStr}
            onChange={(e) => setGradePctStr(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </label>
      </div>

      {modeMeta ? <p className="mt-2 text-[0.65rem] text-gray-500">{modeMeta.hint}</p> : null}

      {mode === "cycling_power_anchors" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              {t("duration1Label")}
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cD1} onChange={(e) => setCD1(e.target.value)} />
            </label>
            <label className="text-xs text-gray-400">
              W 1
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cP1} onChange={(e) => setCP1(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              {t("duration2Label")}
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cD2} onChange={(e) => setCD2(e.target.value)} />
            </label>
            <label className="text-xs text-gray-400">
              W 2
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cP2} onChange={(e) => setCP2(e.target.value)} />
            </label>
          </div>
        </div>
      ) : null}

      {mode === "reference_w_phenotype" ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-xs text-gray-400">
            {t("referenceWLabel")}
            <input
              className="mt-1 block w-32 rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm"
              value={refW}
              onChange={(e) => setRefW(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-400">
            {t("phenotypeLabel")}
            <select
              className="mt-1 block rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-gray-200"
              value={phenotype}
              onChange={(e) => setPhenotype(e.target.value as "oxidative" | "balanced" | "glycolytic")}
            >
              <option value="oxidative">{t("phenotypeOxidative")}</option>
              <option value="balanced">{t("phenotypeBalanced")}</option>
              <option value="glycolytic">{t("phenotypeGlycolytic")}</option>
            </select>
          </label>
        </div>
      ) : null}

      {mode === "running_race_riegel" ||
      mode === "swimming_pace_riegel" ||
      mode === "velocity_sport_riegel" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              {t("distance1Label")}
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceD1} onChange={(e) => setRaceD1(e.target.value)} />
            </label>
            <label className="text-xs text-gray-400">
              {t("time1Label")}
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceT1} onChange={(e) => setRaceT1(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              {t("distance2Label")}
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceD2} onChange={(e) => setRaceD2(e.target.value)} />
            </label>
            <label className="text-xs text-gray-400">
              {t("time2Label")}
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceT2} onChange={(e) => setRaceT2(e.target.value)} />
            </label>
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-[0.65rem] text-gray-600">
        {t.rich("weightUsed", {
          w: () => <span className="font-mono text-gray-400">{bodyMassKg.toFixed(1)}</span>,
        })}
        {!massOk ? t("weightUsedHint") : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Pro2Button type="button" variant="secondary" className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20" disabled={loading} onClick={() => void runSuggest()}>
          {loading ? t("calculating") : t("calculateSuggestion")}
        </Pro2Button>
        <Pro2Button type="button" variant="primary" disabled={!result || loading} onClick={applyPreview}>
          {t("applyToCpCurvePreview")}
        </Pro2Button>
        {onSaveMetabolicProfile ? (
          <Pro2Button
            type="button"
            variant="primary"
            disabled={metabolicProfileSaveDisabled}
            onClick={onSaveMetabolicProfile}
          >
            {metabolicProfileSaveLabel}
          </Pro2Button>
        ) : null}
      </div>

      {err ? (
        <p className="mt-2 text-sm text-amber-300/95" role="alert">
          {err}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-xs text-gray-400">{result.handoffHintIt}</p>
          {result.notes.length ? (
            <ul className="list-inside list-disc text-[0.65rem] text-gray-500">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="py-1 pr-2">{t("tableDuration")}</th>
                  <th className="py-1 pr-2">W eq.</th>
                  <th className="py-1">VO₂ ml/kg/min</th>
                </tr>
              </thead>
              <tbody>
                {MULTISPORT_CP_CURVE_LABELS.map((label) => (
                  <tr key={label} className="border-b border-white/5 font-mono text-gray-200">
                    <td className="py-1 pr-2">{label}</td>
                    <td className="py-1 pr-2">{result.cpCurveInputsW[label] != null ? `${Math.round(result.cpCurveInputsW[label]!)}` : "—"}</td>
                    <td className="py-1">{result.vo2MlKgMinByLabel[label] != null ? result.vo2MlKgMinByLabel[label]!.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
