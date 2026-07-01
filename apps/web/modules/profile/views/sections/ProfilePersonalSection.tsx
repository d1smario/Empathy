"use client";

import type { Dispatch, SetStateAction } from "react";
import { SettingsLocalePreference } from "@/components/settings/SettingsLocalePreference";
import { profileToneForEditorSection } from "@/lib/profile/profile-page-kit";
import type { ProfileFormState } from "@/modules/profile/views/sections/profile-form-state";

/**
 * Sezione "Personale" dell'editor profilo (decomposizione del God-component).
 * Render-only: lo stato resta nel padre (ProfilePageView) e arriva via props;
 * il save handler centralizzato continua a leggere lo stesso `form`.
 */
export type ProfilePersonalSectionProps = {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
};

export function ProfilePersonalSection({ form, setForm }: ProfilePersonalSectionProps) {
  return (
    <div>
      <h3 className={`profile-section-band tone-${profileToneForEditorSection("personal")}`}><span className="profile-kpi-dot" />Personal data</h3>
      <div className="profile-editor-grid">
      <div className="form-group"><label className="form-label">First name</label><input type="text" className="form-input" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Last name</label><input type="text" className="form-input" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Date of birth</label><input type="date" className="form-input" value={form.birth_date} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Gender</label><select className="form-select" value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
      <div className="form-group"><label className="form-label">Activity level</label><select className="form-select" value={form.activity_level} onChange={(e) => setForm((f) => ({ ...f, activity_level: e.target.value }))}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="elite">Elite</option></select></div>
      <div className="form-group"><label className="form-label">Lifestyle</label><select className="form-select" value={form.lifestyle_activity_class} onChange={(e) => setForm((f) => ({ ...f, lifestyle_activity_class: e.target.value }))}><option value="sedentary">Sedentary +15%</option><option value="moderate">Moderate +20%</option><option value="active">Active +30%</option><option value="very_active">Very active +40%</option></select></div>
      <div className="form-group"><label className="form-label">Time zone</label><input type="text" className="form-input" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} /></div>
      </div>
      <div style={{ marginTop: "12px" }}>
        <SettingsLocalePreference />
      </div>
    </div>
  );
}
