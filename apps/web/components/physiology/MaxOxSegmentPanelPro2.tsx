"use client";

import { useState } from "react";
import { Activity, Route } from "lucide-react";
import { Pro2Button } from "@/components/ui/empathy";

export type MaxOxSegmentForm = {
  duration_min: string;
  distance_km: string;
  elevation_m: string;
  power_w: string;
  velocity_m_min: string;
  grade_pct: string;
  smo2_work: string;
  smo2_rest: string;
  lactate_mmol: string;
  core_temp_c: string;
};

const EMPTY: MaxOxSegmentForm = {
  duration_min: "20",
  distance_km: "",
  elevation_m: "",
  power_w: "",
  velocity_m_min: "",
  grade_pct: "",
  smo2_work: "",
  smo2_rest: "",
  lactate_mmol: "",
  core_temp_c: "",
};

const inputClass =
  "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm tabular-nums text-white placeholder:text-gray-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500";

export function MaxOxSegmentPanelPro2({
  onSyncProfile,
  onSyncLactate,
  onApplySegment,
  lastSegmentVo2LMin,
  lastSegmentO2TotalL,
  lastSegmentDurationMin,
}: {
  onSyncProfile: () => void;
  onSyncLactate: () => void;
  onApplySegment: (form: MaxOxSegmentForm) => void;
  lastSegmentVo2LMin: number | null;
  lastSegmentO2TotalL: number | null;
  lastSegmentDurationMin: number | null;
}) {
  const [form, setForm] = useState<MaxOxSegmentForm>(EMPTY);

  const set =
    (key: keyof MaxOxSegmentForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  return (
    <div className="physiology-pro2-lab-page-panel">
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--maxox-inputs">
        <Route className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Steady-load segment · profile / lactate</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>
      <p className="mb-3 max-w-[62ch] text-xs leading-relaxed text-gray-500">
        The <strong className="text-gray-300">oxidative capacity</strong> in the engine stays the{" "}
        <strong className="text-gray-300">VO₂max from Metabolic Profile</strong> (device source). Here we estimate the{" "}
        <strong className="text-gray-300">VO₂ at the segment load</strong> (L/min) and the <strong className="text-gray-300">cumulative O₂</strong>{" "}
        (L/min × minutes). Use a homogeneous stretch (e.g. a constant climb).
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
          onClick={onSyncProfile}
        >
          Take from Metabolic Profile
        </Pro2Button>
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
          onClick={onSyncLactate}
        >
          Take from Lactate lab
        </Pro2Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Duration (min)
          <input className={`${inputClass} mt-1`} type="number" min={0} step={0.5} value={form.duration_min} onChange={set("duration_min")} />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Average power (W)
          <input className={`${inputClass} mt-1`} type="number" min={0} value={form.power_w} onChange={set("power_w")} placeholder="e.g. 280" />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Elevation gain (m)
          <input className={`${inputClass} mt-1`} type="number" value={form.elevation_m} onChange={set("elevation_m")} placeholder="opt." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Horizontal distance (km)
          <input
            className={`${inputClass} mt-1`}
            type="number"
            min={0}
            step={0.01}
            value={form.distance_km}
            onChange={set("distance_km")}
            placeholder="for grade %"
          />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Manual grade (%)
          <input className={`${inputClass} mt-1`} type="number" value={form.grade_pct} onChange={set("grade_pct")} placeholder="opt." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Velocity (m/min)
          <input className={`${inputClass} mt-1`} type="number" min={0} value={form.velocity_m_min} onChange={set("velocity_m_min")} placeholder="run/ski" />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          SmO₂ work (%)
          <input className={`${inputClass} mt-1`} type="number" value={form.smo2_work} onChange={set("smo2_work")} placeholder="opt." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          SmO₂ rest (%)
          <input className={`${inputClass} mt-1`} type="number" value={form.smo2_rest} onChange={set("smo2_rest")} placeholder="opt." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Lactate (mmol/L)
          <input className={`${inputClass} mt-1`} type="number" min={0} step={0.1} value={form.lactate_mmol} onChange={set("lactate_mmol")} placeholder="opt." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500">
          Core temp. (°C)
          <input className={`${inputClass} mt-1`} type="number" step={0.1} value={form.core_temp_c} onChange={set("core_temp_c")} placeholder="opt." />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Pro2Button type="button" variant="primary" onClick={() => onApplySegment(form)}>
          Apply segment to Max Oxidate
        </Pro2Button>
        {lastSegmentVo2LMin != null && lastSegmentDurationMin != null ? (
          <span className="text-xs text-gray-500">
            Last: VO₂ at load <strong className="font-mono tabular-nums text-white">{lastSegmentVo2LMin.toFixed(2)} L/min</strong>
            {lastSegmentO2TotalL != null ? (
              <>
                {" "}
                · cumulative O₂ ~<strong className="font-mono tabular-nums text-white">{lastSegmentO2TotalL.toFixed(2)} L</strong> / {lastSegmentDurationMin.toFixed(1)} min
              </>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
