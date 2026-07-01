"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  WeekDay,
  RoutineDayConfig,
  weekDays,
  profileToneForEditorSection,
} from "@/lib/profile/profile-page-kit";
import type { ProfileFormState } from "@/modules/profile/views/sections/profile-form-state";

/**
 * Sezione "Routine" dell'editor profilo (decomposizione del God-component).
 * Render-only: stato (form + piano settimanale routine) nel padre, passato via
 * props; gli handler centralizzati (updateRoutineDay, save) restano nel padre.
 */
export type ProfileRoutineSectionProps = {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  routineWeekPlan: Record<WeekDay, RoutineDayConfig>;
  setRoutineWeekPlan: Dispatch<SetStateAction<Record<WeekDay, RoutineDayConfig>>>;
  activeRoutineDay: WeekDay;
  setActiveRoutineDay: Dispatch<SetStateAction<WeekDay>>;
  updateRoutineDay: (day: WeekDay, patch: Partial<RoutineDayConfig>) => void;
};

export function ProfileRoutineSection({
  form,
  setForm,
  routineWeekPlan,
  setRoutineWeekPlan,
  activeRoutineDay,
  setActiveRoutineDay,
  updateRoutineDay,
}: ProfileRoutineSectionProps) {
  void setRoutineWeekPlan;
  return (
    <div>
      <h3 className={`profile-section-band tone-${profileToneForEditorSection("routine")}`}><span className="profile-kpi-dot" />Weekly routine</h3>
      <div className="profile-day-strip">
        {weekDays.map((day) => (
          <button
            key={day}
            type="button"
            className={`profile-day-chip ${activeRoutineDay === day ? "active" : ""}`}
            onClick={() => setActiveRoutineDay(day)}
          >
            {day}
          </button>
        ))}
      </div>
      <div className="profile-subpanel tone-green" style={{ marginBottom: "12px" }}>
        <div className="profile-editor-grid profile-editor-grid-compact">
          <div className="form-group"><label className="form-label">Wake up</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].wake_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { wake_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Breakfast</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].breakfast_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { breakfast_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Snack</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].snack_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { snack_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Lunch</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].lunch_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { lunch_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Afternoon snack</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].afternoon_snack_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { afternoon_snack_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Dinner</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].dinner_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { dinner_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Night</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].night_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { night_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Day type</label><select className="form-select profile-dark-select" value={routineWeekPlan[activeRoutineDay].day_mode} onChange={(e) => updateRoutineDay(activeRoutineDay, { day_mode: e.target.value as RoutineDayConfig["day_mode"] })}><option value="training">Training</option><option value="recovery">Recovery</option><option value="race">Race</option></select></div>
        </div>
      </div>
      <div className="profile-subpanel tone-green" style={{ marginBottom: "12px" }}>
        <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />Training sessions for the day</h4>
        <div className="profile-editor-grid profile-editor-grid-compact">
          <div className="form-group"><label className="form-label">Training planned</label><select className="form-select profile-dark-select" value={String(routineWeekPlan[activeRoutineDay].has_training)} onChange={(e) => updateRoutineDay(activeRoutineDay, { has_training: e.target.value === "true" })}><option value="true">Yes</option><option value="false">No</option></select></div>
          <div className="form-group"><label className="form-label">Training 1 start</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].training1_start_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { training1_start_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Training 1 duration (min)</label><input className="form-input" type="number" min={0} value={routineWeekPlan[activeRoutineDay].training1_duration_minutes} onChange={(e) => updateRoutineDay(activeRoutineDay, { training1_duration_minutes: Number(e.target.value || 0) })} /></div>
          <div className="form-group"><label className="form-label">Training 2 planned</label><select className="form-select profile-dark-select" value={String(routineWeekPlan[activeRoutineDay].has_training2)} onChange={(e) => updateRoutineDay(activeRoutineDay, { has_training2: e.target.value === "true" })}><option value="false">No</option><option value="true">Yes</option></select></div>
          <div className="form-group"><label className="form-label">Training 2 start</label><input className="form-input" type="time" value={routineWeekPlan[activeRoutineDay].training2_start_time} onChange={(e) => updateRoutineDay(activeRoutineDay, { training2_start_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Training 2 duration (min)</label><input className="form-input" type="number" min={0} value={routineWeekPlan[activeRoutineDay].training2_duration_minutes} onChange={(e) => updateRoutineDay(activeRoutineDay, { training2_duration_minutes: Number(e.target.value || 0) })} /></div>
          <div className="form-group"><label className="form-label">Mobility/Stretching %</label><input className="form-input" type="number" min={0} max={100} value={routineWeekPlan[activeRoutineDay].mobility_stretching_pct} onChange={(e) => updateRoutineDay(activeRoutineDay, { mobility_stretching_pct: Number(e.target.value || 0) })} /></div>
        </div>
      </div>
      <div className="form-group"><label className="form-label">Routine notes</label><textarea className="form-textarea" value={form.routine_summary} onChange={(e) => setForm((f) => ({ ...f, routine_summary: e.target.value }))} /></div>
    </div>
  );
}
