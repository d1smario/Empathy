"use client";

import type { Dispatch, SetStateAction } from "react";
import { profileToneForEditorSection } from "@/lib/profile/profile-page-kit";
import type { ProfileFormState } from "@/modules/profile/views/sections/profile-form-state";

/**
 * Sezione "Fisico" dell'editor profilo (decomposizione del God-component).
 * Render-only: stato nel padre, passato via props; save handler invariato.
 */
export type ProfilePhysicalSectionProps = {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
};

export function ProfilePhysicalSection({ form, setForm }: ProfilePhysicalSectionProps) {
  return (
    <div>
      <h3 className={`profile-section-band tone-${profileToneForEditorSection("physical")}`}><span className="profile-kpi-dot" />Physical Measurements</h3>
      <div className="profile-editor-grid">
      <div className="form-group"><label className="form-label">Height (cm)</label><input className="form-input" type="number" value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Weight (kg)</label><input className="form-input" type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Body Fat (%)</label><input className="form-input" type="number" step="0.1" value={form.body_fat_pct} onChange={(e) => setForm((f) => ({ ...f, body_fat_pct: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Muscle Mass (kg)</label><input className="form-input" type="number" step="0.1" value={form.muscle_mass_kg} onChange={(e) => setForm((f) => ({ ...f, muscle_mass_kg: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Resting HR</label><input className="form-input" type="number" value={form.resting_hr_bpm} onChange={(e) => setForm((f) => ({ ...f, resting_hr_bpm: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Max HR</label><input className="form-input" type="number" value={form.max_hr_bpm} onChange={(e) => setForm((f) => ({ ...f, max_hr_bpm: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Threshold HR</label><input className="form-input" type="number" value={form.threshold_hr_bpm} onChange={(e) => setForm((f) => ({ ...f, threshold_hr_bpm: e.target.value }))} /></div>
      </div>
    </div>
  );
}
