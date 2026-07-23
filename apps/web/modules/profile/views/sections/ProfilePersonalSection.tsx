"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { SettingsLocalePreference } from "@/components/settings/SettingsLocalePreference";
import { profileToneForEditorSection, toggleCsvToken } from "@/lib/profile/profile-page-kit";
import { PROFILE_GOAL_OPTIONS, type ProfileFormState } from "@/modules/profile/views/sections/profile-form-state";

/** Etichetta i18n per ogni valore canonico (i valori restano IT nel DB). */
const GOAL_OPTION_LABEL_KEY: Record<(typeof PROFILE_GOAL_OPTIONS)[number], string> = {
  performance: "goalOptionPerformance",
  salute: "goalOptionSalute",
  dimagrimento: "goalOptionDimagrimento",
  gara: "goalOptionGara",
  resistenza: "goalOptionResistenza",
};

/**
 * Sezione "Personale" dell'editor profilo (decomposizione del God-component).
 * Render-only: lo stato resta nel padre (ProfilePageView) e arriva via props;
 * il save handler centralizzato continua a leggere lo stesso `form`.
 */
export type ProfilePersonalSectionProps = {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  /** In scope coach/admin l'email è read-only: è la chiave di match/dedup dell'atleta. */
  lockIdentity?: boolean;
};

export function ProfilePersonalSection({ form, setForm, lockIdentity = false }: ProfilePersonalSectionProps) {
  const t = useTranslations("ProfilePersonalSection");
  const selectedGoals = new Set(form.goals.split(",").map((s) => s.trim()).filter(Boolean));
  return (
    <div>
      <h3 className={`profile-section-band tone-${profileToneForEditorSection("personal")}`}><span className="profile-kpi-dot" />{t("personalDataTitle")}</h3>
      <div className="profile-editor-grid">
      <div className="form-group"><label className="form-label">{t("firstNameLabel")}</label><input type="text" className="form-input" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">{t("lastNameLabel")}</label><input type="text" className="form-input" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} disabled={lockIdentity} title={lockIdentity ? t("emailLockedForCoach") : undefined} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">{t("birthDateLabel")}</label><input type="date" className="form-input" value={form.birth_date} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">{t("genderLabel")}</label><select className="form-select" value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}><option value="">—</option><option value="male">{t("genderMale")}</option><option value="female">{t("genderFemale")}</option><option value="other">{t("genderOther")}</option></select></div>
      <div className="form-group"><label className="form-label">{t("activityLevelLabel")}</label><select className="form-select" value={form.activity_level} onChange={(e) => setForm((f) => ({ ...f, activity_level: e.target.value }))}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="elite">Elite</option></select></div>
      <div className="form-group"><label className="form-label">Lifestyle</label><select className="form-select" value={form.lifestyle_activity_class} onChange={(e) => setForm((f) => ({ ...f, lifestyle_activity_class: e.target.value }))}><option value="sedentary">Sedentary +15%</option><option value="moderate">Moderate +20%</option><option value="active">Active +30%</option><option value="very_active">Very active +40%</option></select></div>
      <div className="form-group"><label className="form-label">{t("timezoneLabel")}</label><input type="text" className="form-input" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} /></div>
      </div>

      {/* Obiettivo / focus: chips canonici (valori IT persistiti in athlete_profiles.goals,
          letti dal generatore settimana) + testo libero opzionale. */}
      <h3 className={`profile-section-band tone-${profileToneForEditorSection("personal")}`} style={{ marginTop: "16px" }}>
        <span className="profile-kpi-dot" />{t("goalFocusTitle")}
      </h3>
      <p className="mb-2 text-xs text-gray-400">{t("goalFocusHint")}</p>
      <div className="flex flex-wrap gap-2">
        {PROFILE_GOAL_OPTIONS.map((goal) => {
          const active = selectedGoals.has(goal);
          return (
            <button
              key={goal}
              type="button"
              aria-pressed={active}
              onClick={() => setForm((f) => ({ ...f, goals: toggleCsvToken(f.goals, goal) }))}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-orange-500/60 bg-orange-500/15 text-orange-100"
                  : "border-white/15 bg-white/5 text-gray-300 hover:border-white/30 hover:text-white"
              }`}
            >
              {t(GOAL_OPTION_LABEL_KEY[goal])}
            </button>
          );
        })}
      </div>
      <div className="form-group" style={{ marginTop: "10px" }}>
        <label className="form-label">{t("goalFreeTextLabel")}</label>
        <input
          type="text"
          className="form-input"
          placeholder={t("goalFreeTextPlaceholder")}
          value={form.goal_note}
          onChange={(e) => setForm((f) => ({ ...f, goal_note: e.target.value }))}
        />
      </div>

      <div style={{ marginTop: "12px" }}>
        <SettingsLocalePreference />
      </div>
    </div>
  );
}
