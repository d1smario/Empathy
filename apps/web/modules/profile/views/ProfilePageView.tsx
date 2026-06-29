"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ProfilePro2KpiGrid,
  profileMetricLabelToAccent,
  profileSectionTitleToAccent,
} from "@/components/profile/ProfilePro2KpiCard";
import { InviteCoachCard } from "@/components/profile/InviteCoachCard";
import { SettingsBuildPhasesCard } from "@/components/settings/SettingsBuildPhasesCard";
import { SettingsAuthSessionDiagnostics } from "@/components/settings/SettingsAuthSessionDiagnostics";
import { SettingsAthleteContextDiagnostics } from "@/components/settings/SettingsAthleteContextDiagnostics";
import { SettingsIntegrationsDiagnostics } from "@/components/settings/SettingsIntegrationsDiagnostics";
import { SettingsBillingDiagnostics } from "@/components/settings/SettingsBillingDiagnostics";
import { PlatformAdminOnly } from "@/components/auth/PlatformAdminOnly";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import type { AthleteMemory, PhysiologyState, TwinState } from "@/lib/empathy/schemas";
import { cn } from "@/lib/cn";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { createProfilePayload, fetchProfileViewModel, updateProfilePayload } from "@/modules/profile/services/profile-api";
import { ProfileDevicesSection } from "@/modules/profile/views/sections/ProfileDevicesSection";
import { ProfilePersonalSection } from "@/modules/profile/views/sections/ProfilePersonalSection";
import { ProfilePhysicalSection } from "@/modules/profile/views/sections/ProfilePhysicalSection";
import { ProfileRoutineSection } from "@/modules/profile/views/sections/ProfileRoutineSection";
import { ProfileNutritionSection } from "@/modules/profile/views/sections/ProfileNutritionSection";
import {
  normalizeSupplementCategoryId,
  normalizeSupplementToken,
  normalizeSupplementTokensCsv,
} from "@/lib/profile/supplement-category-catalog";
import { resolveSixMealSnackPercentages } from "@/lib/nutrition/diet-meal-slot-budgets";
import { Activity, Dna, Flame, GaugeCircle, Heart, Layers, PencilLine, Settings2, UserCheck, X } from "lucide-react";
import {
  AthleteProfileRow,
  PhysiologyRow,
  WeekDay,
  RoutineDayConfig,
  DietDayConfig,
  weekDays,
  mapAthleteMemoryToProfileRow,
  mapAthleteMemoryToPhysiologyRow,
  defaultRoutineDayConfig,
  defaultDietDayConfig,
  defaultRoutineWeek,
  defaultDietWeek,
  parseCsvList,
  joinUnique,
  hasDisplayValue,
  toRecord,
  classifyAthleteType,
  athleteTypePillClass,
  editorTabClass,
  profileToneForEditorSection,
  estimateVo2maxMlMinKg,
} from "@/lib/profile/profile-page-kit";

// Cache cross-mount del view-model profilo: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/"refresh"); refetch in background solo se la
// cache è più vecchia di PROFILE_VM_FRESH_MS, o forzato dopo un salvataggio.
let profileVmCacheId: string | null = null;
let profileVmCache: Awaited<ReturnType<typeof fetchProfileViewModel>> | null = null;
let profileVmCacheAt = 0;
const PROFILE_VM_FRESH_MS = 60_000;

export default function ProfilePage({
  hasLinkedCoach = false,
  hasActivePlan = false,
  linkedCoach = null,
}: {
  hasLinkedCoach?: boolean;
  hasActivePlan?: boolean;
  linkedCoach?: { name: string; email: string | null } | null;
}) {
  const { activeAthleteId, role, adminScoped, loading: athleteLoading } = useActiveAthlete();
  // Output del motore (segnali fisiologici, copertura dataset, digital twin) e note
  // tecniche: roba da coach/admin, non dall'atleta. Stesso pattern showTech del resto.
  const showTech = role === "coach" || adminScoped;
  const [profiles, setProfiles] = useState<AthleteProfileRow[]>([]);
  const [physioMap, setPhysioMap] = useState<Record<string, PhysiologyRow>>({});
  const [physiologyState, setPhysiologyState] = useState<PhysiologyState | null>(null);
  const [physiologyCoverage, setPhysiologyCoverage] = useState<{
    physiologicalProfile: boolean;
    metabolicRun: boolean;
    lactateRun: boolean;
    performanceRun: boolean;
    biomarkerPanel: boolean;
  } | null>(null);
  const [twinSnapshot, setTwinSnapshot] = useState<TwinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"personal" | "physical" | "routine" | "nutrition" | "devices">("personal");
  const [activeNutritionTab, setActiveNutritionTab] = useState<"diet" | "intolerances" | "supplements">("diet");
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const [activeSupplementCategory, setActiveSupplementCategory] = useState("carboidrati");
  const [daysActive, setDaysActive] = useState(0);
  const [activeRoutineDay, setActiveRoutineDay] = useState<WeekDay>("Mon");
  const [activeDietDay, setActiveDietDay] = useState<WeekDay>("Mon");
  const [routineWeekPlan, setRoutineWeekPlan] = useState<Record<WeekDay, RoutineDayConfig>>(defaultRoutineWeek());
  const [dietWeekPlan, setDietWeekPlan] = useState<Record<WeekDay, DietDayConfig>>(defaultDietWeek());

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    birth_date: "",
    sex: "",
    timezone: "Europe/Rome",
    activity_level: "advanced",
    height_cm: "",
    weight_kg: "",
    body_fat_pct: "",
    muscle_mass_kg: "",
    resting_hr_bpm: "",
    max_hr_bpm: "",
    threshold_hr_bpm: "",
    training_days_per_week: "",
    training_max_session_minutes: "",
    wake_time: "06:30",
    sleep_time: "22:30",
    breakfast_time: "07:00",
    lunch_time: "12:30",
    dinner_time: "19:30",
    training_slot: "morning",
    second_session: "false",
    race_day: "false",
    training_duration_minutes: "90",
    training1_start_time: "07:00",
    training1_duration_minutes: "75",
    training2_start_time: "18:00",
    training2_duration_minutes: "60",
    meal_strategy: "3-meals",
    caloric_split_breakfast: "25",
    caloric_split_lunch: "35",
    caloric_split_dinner: "30",
    caloric_split_snacks: "10",
    macro_carbs_pct: "50",
    macro_protein_pct: "25",
    macro_fat_pct: "25",
    routine_summary: "",
    lifestyle_activity_class: "moderate",
    diet_type: "omnivore",
    cuisines: "",
    preferred_meal_count: "4",
    prep_time_minutes: "45",
    cooking_skill: "intermediate",
    home_cooked_preference: "true",
    food_preferences: "",
    food_exclusions: "",
    intolerances: "",
    allergies: "",
    supplements: "",
    supplement_brands: "",
  });

  function applyProfileVm(vm: NonNullable<typeof profileVmCache>) {
    const memory = vm.athleteMemory ?? null;
    const mappedProfile = mapAthleteMemoryToProfileRow(memory);
    setProfiles(mappedProfile ? [mappedProfile] : vm.profile ? [vm.profile as AthleteProfileRow] : []);
    setDaysActive(vm.activity.daysActive);
    const map: Record<string, PhysiologyRow> = {};
    const mappedPhysio = mapAthleteMemoryToPhysiologyRow(memory);
    if (mappedPhysio) {
      map[mappedPhysio.athlete_id] = mappedPhysio;
    } else if (vm.physiology) {
      const physio = vm.physiology as PhysiologyRow;
      if (physio.athlete_id) map[physio.athlete_id] = physio;
    }
    setPhysioMap(map);
    setPhysiologyState((memory?.physiology as PhysiologyState | null) ?? ((vm.physiologyState as PhysiologyState | null) ?? null));
    setPhysiologyCoverage(vm.physiologyCoverage ?? memory?.physiology?.sources ?? null);
    setTwinSnapshot(vm.athleteMemory?.twin ?? null);
  }

  async function load() {
    if (!activeAthleteId) {
      setProfiles([]);
      setPhysioMap({});
      setPhysiologyState(null);
      setPhysiologyCoverage(null);
      setTwinSnapshot(null);
      setLoading(false);
      return;
    }
    // Se i dati di questo atleta sono già in cache, mostrali SUBITO (niente
    // spinner/"refresh"); aggiorna in background solo se la cache è "stale".
    const hasCache = profileVmCacheId === activeAthleteId && profileVmCache != null && !profileVmCache.error;
    if (hasCache) {
      applyProfileVm(profileVmCache!);
      setError(null);
      setLoading(false);
      if (Date.now() - profileVmCacheAt < PROFILE_VM_FRESH_MS) return;
    } else {
      setLoading(true);
      setError(null);
    }
    const vm = await fetchProfileViewModel(activeAthleteId);
    if (vm.error) {
      if (!hasCache) {
        setError(vm.error);
        setProfiles([]);
        setPhysioMap({});
        setPhysiologyState(null);
        setPhysiologyCoverage(null);
        setTwinSnapshot(null);
        setDaysActive(0);
        setLoading(false);
      }
      return;
    }
    profileVmCache = vm;
    profileVmCacheId = activeAthleteId;
    profileVmCacheAt = Date.now();
    applyProfileVm(vm);
    setLoading(false);
  }

  useEffect(() => {
    if (!athleteLoading) load();
  }, [athleteLoading, activeAthleteId]);

  // Esc chiude il modale "Modifica profilo". (Il blocco dello scroll di sfondo è
  // fatto con un tag <style> dentro il render del modale, non qui: così si applica
  // in modo sincrono col layout e sopravvive all'HMR / Fast Refresh.)
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowForm(false);
        setEditingProfileId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm]);

  function startEditProfile(p: AthleteProfileRow) {
    const routine = toRecord(p.routine_config);
    const mealTimes = toRecord(routine.meal_times);
    const training1 = toRecord(routine.training_1);
    const training2 = toRecord(routine.training_2);
    const nutrition = toRecord(p.nutrition_config);
    const caloricSplit = toRecord(nutrition.caloric_split);
    const macroSplit = toRecord(nutrition.macro_split);
    const supplementCfg = toRecord(p.supplement_config);
    const selectedBrands = Array.isArray(supplementCfg.selected_brands) ? supplementCfg.selected_brands.map((v) => String(v)) : [];
    const routineWeekRaw = toRecord(routine.week_plan);
    const nutritionWeekRaw = toRecord(nutrition.week_plan);

    const parsedRoutineWeek = defaultRoutineWeek();
    const parsedDietWeek = defaultDietWeek();

    weekDays.forEach((day) => {
      const dayRoutine = toRecord(routineWeekRaw[day]);
      parsedRoutineWeek[day] = {
        ...defaultRoutineDayConfig(),
        ...dayRoutine,
        day_mode: (String(dayRoutine.day_mode ?? "training") as RoutineDayConfig["day_mode"]),
        has_training: String(dayRoutine.has_training ?? true) === "true",
        has_training2: String(dayRoutine.has_training2 ?? false) === "true",
        training1_duration_minutes: Number(dayRoutine.training1_duration_minutes ?? 75),
        training2_duration_minutes: Number(dayRoutine.training2_duration_minutes ?? 45),
        mobility_stretching_pct: Number(dayRoutine.mobility_stretching_pct ?? 20),
      };

      const dayDiet = toRecord(nutritionWeekRaw[day]);
      const cal = toRecord(dayDiet.caloric_distribution);
      const macros = toRecord(dayDiet.daily_macros);
      const mealMacro = toRecord(dayDiet.meal_macro_custom);
      const mealCountMode = String(dayDiet.meal_count_mode ?? "4") as DietDayConfig["meal_count_mode"];
      const breakfast = Number(cal.breakfast ?? 30);
      const lunch = Number(cal.lunch ?? 35);
      const dinner = Number(cal.dinner ?? 25);
      const snacksField = Number(cal.snacks ?? 10);
      const distSeed = {
        breakfast,
        lunch,
        dinner,
        snacks: snacksField,
        ...(typeof cal.snack_am === "number" ? { snack_am: cal.snack_am } : {}),
        ...(typeof cal.snack_pm === "number" ? { snack_pm: cal.snack_pm } : {}),
        ...(typeof cal.snack_evening === "number" ? { snack_evening: cal.snack_evening } : {}),
      };
      const caloricResolved =
        mealCountMode === "6"
          ? (() => {
              const r = resolveSixMealSnackPercentages(distSeed);
              return {
                breakfast,
                lunch,
                dinner,
                snacks: r.snacksTotal,
                snack_am: r.snack_am,
                snack_pm: r.snack_pm,
                snack_evening: r.snack_evening,
              };
            })()
          : { breakfast, lunch, dinner, snacks: snacksField };
      parsedDietWeek[day] = {
        ...defaultDietDayConfig(),
        ...dayDiet,
        day_type: String(dayDiet.day_type ?? "normocaloric-100") as DietDayConfig["day_type"],
        meal_count_mode: mealCountMode,
        day_type_pct: Number(dayDiet.day_type_pct ?? 100),
        caloric_distribution: caloricResolved,
        daily_macros: {
          cho_pct: Number(macros.cho_pct ?? 50),
          pro_pct: Number(macros.pro_pct ?? 25),
          fat_pct: Number(macros.fat_pct ?? 25),
        },
        meal_macro_custom: {
          breakfast: { ...defaultDietDayConfig().meal_macro_custom.breakfast, ...toRecord(mealMacro.breakfast) } as DietDayConfig["meal_macro_custom"]["breakfast"],
          lunch: { ...defaultDietDayConfig().meal_macro_custom.lunch, ...toRecord(mealMacro.lunch) } as DietDayConfig["meal_macro_custom"]["lunch"],
          dinner: { ...defaultDietDayConfig().meal_macro_custom.dinner, ...toRecord(mealMacro.dinner) } as DietDayConfig["meal_macro_custom"]["dinner"],
          snacks: { ...defaultDietDayConfig().meal_macro_custom.snacks, ...toRecord(mealMacro.snacks) } as DietDayConfig["meal_macro_custom"]["snacks"],
        },
      };
    });

    setEditingProfileId(p.id);
    setShowForm(true);
    setActiveSection("personal");
    setRoutineWeekPlan(parsedRoutineWeek);
    setDietWeekPlan(parsedDietWeek);
    setForm((f) => ({
      ...f,
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      email: p.email ?? "",
      birth_date: p.birth_date ?? "",
      sex: p.sex ?? "",
      timezone: p.timezone ?? "Europe/Rome",
      activity_level: p.activity_level ?? "advanced",
      height_cm: p.height_cm != null ? String(p.height_cm) : "",
      weight_kg: p.weight_kg != null ? String(p.weight_kg) : "",
      body_fat_pct: p.body_fat_pct != null ? String(p.body_fat_pct) : "",
      muscle_mass_kg: p.muscle_mass_kg != null ? String(p.muscle_mass_kg) : "",
      resting_hr_bpm: p.resting_hr_bpm != null ? String(p.resting_hr_bpm) : "",
      max_hr_bpm: p.max_hr_bpm != null ? String(p.max_hr_bpm) : "",
      threshold_hr_bpm: p.threshold_hr_bpm != null ? String(p.threshold_hr_bpm) : "",
      training_days_per_week: p.training_days_per_week != null ? String(p.training_days_per_week) : "",
      training_max_session_minutes: p.training_max_session_minutes != null ? String(p.training_max_session_minutes) : "",
      wake_time: String(routine.wake_time ?? "06:30"),
      sleep_time: String(routine.sleep_time ?? "22:30"),
      breakfast_time: String(mealTimes.breakfast ?? "07:00"),
      lunch_time: String(mealTimes.lunch ?? "12:30"),
      dinner_time: String(mealTimes.dinner ?? "19:30"),
      training_slot: String(routine.training_slot ?? "morning"),
      second_session: String(routine.second_session ?? false) === "true" ? "true" : "false",
      race_day: String(routine.race_day ?? false) === "true" ? "true" : "false",
      training_duration_minutes: routine.training_duration_minutes != null ? String(routine.training_duration_minutes) : "90",
      training1_start_time: String(training1.start_time ?? "07:00"),
      training1_duration_minutes: training1.duration_minutes != null ? String(training1.duration_minutes) : "75",
      training2_start_time: String(training2.start_time ?? "18:00"),
      training2_duration_minutes: training2.duration_minutes != null ? String(training2.duration_minutes) : "60",
      meal_strategy: String(nutrition.meal_strategy ?? "3-meals"),
      caloric_split_breakfast: String(caloricSplit.breakfast_pct ?? "25"),
      caloric_split_lunch: String(caloricSplit.lunch_pct ?? "35"),
      caloric_split_dinner: String(caloricSplit.dinner_pct ?? "30"),
      caloric_split_snacks: String(caloricSplit.snacks_pct ?? "10"),
      macro_carbs_pct: String(macroSplit.carbs_pct ?? "50"),
      macro_protein_pct: String(macroSplit.protein_pct ?? "25"),
      macro_fat_pct: String(macroSplit.fat_pct ?? "25"),
      routine_summary: p.routine_summary ?? "",
      lifestyle_activity_class: p.lifestyle_activity_class ?? String(routine.lifestyle_activity_class ?? "moderate"),
      diet_type: p.diet_type ?? "omnivore",
      cuisines: "",
      preferred_meal_count: p.preferred_meal_count != null ? String(p.preferred_meal_count) : "4",
      prep_time_minutes: nutrition.prep_time_minutes != null ? String(nutrition.prep_time_minutes) : "45",
      cooking_skill: String(nutrition.cooking_skill ?? "intermediate"),
      home_cooked_preference: String(nutrition.home_cooked_preference ?? true) === "false" ? "false" : "true",
      food_preferences: (p.food_preferences ?? []).join(", "),
      food_exclusions: (p.food_exclusions ?? []).join(", "),
      intolerances: (p.intolerances ?? []).join(", "),
      allergies: (p.allergies ?? []).join(", "),
      supplements: normalizeSupplementTokensCsv((p.supplements ?? []).join(", ")),
      supplement_brands: selectedBrands.join(", "),
    }));
  }

  function goToEditorSection(
    section: "personal" | "physical" | "routine" | "nutrition" | "devices",
    nutritionTab?: "diet" | "intolerances" | "supplements",
  ) {
    setActiveSection(section);
    if (nutritionTab) setActiveNutritionTab(nutritionTab);
    if (nutritionTab === "supplements") {
      setActiveSupplementCategory(normalizeSupplementCategoryId(activeSupplementCategory));
    }
    // Cambiando sezione riportiamo in cima lo scroll del modale (la barra esterna
    // dell'overlay), così ogni tab riparte dall'alto con la barra tab sticky visibile.
    if (editorScrollRef.current) editorScrollRef.current.scrollTop = 0;
  }

  function updateRoutineDay(day: WeekDay, patch: Partial<RoutineDayConfig>) {
    setRoutineWeekPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  function updateDietDay(day: WeekDay, patch: Partial<DietDayConfig>) {
    setDietWeekPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const routineConfig = {
      lifestyle_activity_class: form.lifestyle_activity_class,
      wake_time: form.wake_time,
      sleep_time: form.sleep_time,
      meal_times: {
        breakfast: form.breakfast_time,
        lunch: form.lunch_time,
        dinner: form.dinner_time,
      },
      training_slot: form.training_slot,
      second_session: form.second_session === "true",
      race_day: form.race_day === "true",
      training_duration_minutes: parseInt(form.training_duration_minutes, 10) || null,
      training_1: {
        start_time: form.training1_start_time || null,
        duration_minutes: parseInt(form.training1_duration_minutes, 10) || null,
      },
      training_2: {
        start_time: form.training2_start_time || null,
        duration_minutes:
          form.second_session === "true"
            ? (parseInt(form.training2_duration_minutes, 10) || null)
            : null,
      },
      week_plan: routineWeekPlan,
    };

    const nutritionConfig = {
      meal_strategy: form.meal_strategy,
      caloric_split: {
        breakfast_pct: parseInt(form.caloric_split_breakfast, 10) || 0,
        lunch_pct: parseInt(form.caloric_split_lunch, 10) || 0,
        dinner_pct: parseInt(form.caloric_split_dinner, 10) || 0,
        snacks_pct: parseInt(form.caloric_split_snacks, 10) || 0,
      },
      macro_split: {
        carbs_pct: parseInt(form.macro_carbs_pct, 10) || 0,
        protein_pct: parseInt(form.macro_protein_pct, 10) || 0,
        fat_pct: parseInt(form.macro_fat_pct, 10) || 0,
      },
      prep_time_minutes: parseInt(form.prep_time_minutes, 10) || null,
      cooking_skill: form.cooking_skill,
      home_cooked_preference: form.home_cooked_preference === "true",
      week_plan: dietWeekPlan,
    };

    const supplementConfig = {
      selected_tokens: (parseCsvList(normalizeSupplementTokensCsv(form.supplements)) ?? []).map(normalizeSupplementToken),
      selected_brands: parseCsvList(form.supplement_brands) ?? [],
    };

    const payload = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      birth_date: form.birth_date || null,
      sex: form.sex || null,
      timezone: form.timezone || null,
      activity_level: form.activity_level || null,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : null,
      muscle_mass_kg: form.muscle_mass_kg ? parseFloat(form.muscle_mass_kg) : null,
      resting_hr_bpm: form.resting_hr_bpm ? parseInt(form.resting_hr_bpm, 10) : null,
      max_hr_bpm: form.max_hr_bpm ? parseInt(form.max_hr_bpm, 10) : null,
      threshold_hr_bpm: form.threshold_hr_bpm ? parseInt(form.threshold_hr_bpm, 10) : null,
      training_days_per_week: form.training_days_per_week ? parseInt(form.training_days_per_week, 10) : null,
      training_max_session_minutes: form.training_max_session_minutes ? parseInt(form.training_max_session_minutes, 10) : null,
      routine_summary: form.routine_summary || null,
      routine_config: routineConfig,
      nutrition_config: nutritionConfig,
      supplement_config: supplementConfig,
      diet_type: form.diet_type || null,
      preferred_meal_count: form.preferred_meal_count ? parseInt(form.preferred_meal_count, 10) : null,
      food_preferences: joinUnique([
        ...(parseCsvList(form.food_preferences) ?? []),
        ...(parseCsvList(form.cuisines) ?? []),
      ]),
      food_exclusions: parseCsvList(form.food_exclusions),
      intolerances: parseCsvList(form.intolerances),
      allergies: parseCsvList(form.allergies),
      supplements: joinUnique([
        ...(parseCsvList(normalizeSupplementTokensCsv(form.supplements)) ?? []).map(normalizeSupplementToken),
        ...(parseCsvList(form.supplement_brands) ?? []),
      ]),
    };

    try {
      if (editingProfileId) {
        /** Stesso id usato da GET `/api/profile?athleteId=` (memoria atleta); evita mismatch con stato form. */
        const putId = (activeAthleteId ?? "").trim() || editingProfileId;
        await updateProfilePayload(putId, payload);
      } else {
        await createProfilePayload(payload);
      }
      setShowForm(false);
      setEditingProfileId(null);
      profileVmCache = null; // forza il refetch dei dati appena salvati
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio profilo");
    }
    setSaving(false);
  }

  const currentProfile = profiles[0] ?? null;
  const currentPhysio = currentProfile ? physioMap[currentProfile.id] : null;
  const resolvedFtp =
    currentPhysio?.ftp_watts ??
    physiologyState?.metabolicProfile.ftpWatts ??
    physiologyState?.physiologicalProfile.ftpWatts ??
    null;
  const resolvedLt1 =
    currentPhysio?.lt1_watts ??
    physiologyState?.metabolicProfile.lt1Watts ??
    physiologyState?.physiologicalProfile.lt1Watts ??
    null;
  const resolvedLt2 =
    currentPhysio?.lt2_watts ??
    physiologyState?.metabolicProfile.lt2Watts ??
    physiologyState?.physiologicalProfile.lt2Watts ??
    null;
  const resolvedVLamax =
    currentPhysio?.v_lamax ??
    physiologyState?.metabolicProfile.vLamax ??
    physiologyState?.physiologicalProfile.vLamax ??
    null;
  const resolvedVo2max =
    currentPhysio?.vo2max_ml_min_kg ??
    physiologyState?.performanceProfile.vo2maxMlMinKg ??
    physiologyState?.physiologicalProfile.vo2maxMlMinKg ??
    null;
  const derivedVo2max =
    resolvedVo2max ??
    estimateVo2maxMlMinKg({
      weightKg: currentProfile?.weight_kg ?? null,
      ftpWatts: resolvedFtp,
      cpWatts:
        currentPhysio?.cp_watts ??
        physiologyState?.metabolicProfile.cpWatts ??
        physiologyState?.physiologicalProfile.cpWatts ??
        null,
      lt2Watts: resolvedLt2,
      oxidativeCapacityKcalMin: physiologyState?.performanceProfile.oxidativeCapacityKcalMin ?? null,
    });
  const vo2maxSourceLabel =
    resolvedVo2max != null
      ? "direct physiology memory"
      : physiologyState?.performanceProfile.oxidativeCapacityKcalMin != null
        ? "derived from oxidative capacity"
        : resolvedLt2 != null
          ? "derived from LT2 / weight"
          : (currentPhysio?.cp_watts ?? physiologyState?.metabolicProfile.cpWatts ?? physiologyState?.physiologicalProfile.cpWatts) != null
            ? "derived from critical power / weight"
            : resolvedFtp != null
              ? "derived from FTP / weight"
              : "not available";
  const ftpPerKg =
    resolvedFtp != null && currentProfile?.weight_kg
      ? resolvedFtp / currentProfile.weight_kg
      : null;
  const athleteType = classifyAthleteType({
    ftpPerKg,
    vLamax: resolvedVLamax,
    vo2max: derivedVo2max,
  });
  const physiologySummarySections = useMemo(() => {
    if (!physiologyState) return [];
    return [
      {
        title: "Metabolic profile",
        cards: [
          {
            label: "FTP",
            value: physiologyState.metabolicProfile.ftpWatts != null ? `${Math.round(physiologyState.metabolicProfile.ftpWatts)} W` : "—",
          },
          {
            label: "FatMax",
            value: physiologyState.metabolicProfile.fatmaxWatts != null ? `${Math.round(physiologyState.metabolicProfile.fatmaxWatts)} W` : "—",
          },
          {
            label: "Indice glic. (proxy)",
            value: physiologyState.metabolicProfile.vLamax != null ? physiologyState.metabolicProfile.vLamax.toFixed(2) : "—",
          },
        ],
      },
      {
        title: "Lactate / gut",
        cards: [
          {
            label: "Lactate oxidized",
            value:
              physiologyState.lactateProfile.lactateOxidizedG != null
                ? `${physiologyState.lactateProfile.lactateOxidizedG.toFixed(1)} g`
                : "—",
          },
          {
            label: "Blood delivery",
            value:
              physiologyState.lactateProfile.bloodDeliveryPctOfIngested != null
                ? `${Math.round(physiologyState.lactateProfile.bloodDeliveryPctOfIngested)}%`
                : "—",
          },
          {
            label: "Gut stress",
            value:
              physiologyState.lactateProfile.gutStressScore != null
                ? `${Math.round(physiologyState.lactateProfile.gutStressScore * 100)}/100`
                : "—",
          },
        ],
      },
      {
        title: "Performance",
        cards: [
          {
            label: "VO2max",
            value: derivedVo2max != null ? `${derivedVo2max.toFixed(1)} ml/kg/min` : "—",
          },
          {
            label: "Oxidative bottleneck",
            value:
              physiologyState.performanceProfile.oxidativeBottleneckIndex != null
                ? `${Math.round(physiologyState.performanceProfile.oxidativeBottleneckIndex)}/100`
                : "—",
          },
          {
            label: "Redox stress",
            value:
              physiologyState.performanceProfile.redoxStressIndex != null
                ? `${Math.round(physiologyState.performanceProfile.redoxStressIndex)}/100`
                : "—",
          },
        ],
      },
      {
        title: "Bioenergetica",
        cards: [
          {
            label: "Phase angle",
            value:
              physiologyState.bioenergeticProfile.phaseAngleScore != null
                ? `${physiologyState.bioenergeticProfile.phaseAngleScore}`
                : "—",
          },
          {
            label: "Mitochondrial efficiency",
            value:
              physiologyState.bioenergeticProfile.mitochondrialEfficiency != null
                ? `${Math.round(physiologyState.bioenergeticProfile.mitochondrialEfficiency)}`
                : "—",
          },
          {
            label: "Hydration status",
            value:
              physiologyState.bioenergeticProfile.hydrationStatus != null
                ? `${Math.round(physiologyState.bioenergeticProfile.hydrationStatus)}`
                : "—",
          },
        ],
      },
      {
        title: "Recovery",
        cards: [
          {
            label: "Resting HR",
            value:
              physiologyState.recoveryProfile.restingHrBpm != null
                ? `${Math.round(physiologyState.recoveryProfile.restingHrBpm)} bpm`
                : "—",
          },
          {
            label: "Max HR",
            value:
              physiologyState.recoveryProfile.maxHrBpm != null
                ? `${Math.round(physiologyState.recoveryProfile.maxHrBpm)} bpm`
                : "—",
          },
        ],
      },
    ]
      .map((section) => ({
        ...section,
        cards: section.cards.filter((card) => hasDisplayValue(card.value)).slice(0, 3),
      }))
      .filter((section) => section.cards.length > 0);
  }, [derivedVo2max, physiologyState]);

  const keyMetricItems = currentProfile
    ? [
        { label: "Peso", value: currentProfile.weight_kg != null ? `${currentProfile.weight_kg} kg` : "—" },
        { label: "Altezza", value: currentProfile.height_cm != null ? `${currentProfile.height_cm} cm` : "—" },
        { label: "Body Fat", value: currentProfile.body_fat_pct != null ? `${currentProfile.body_fat_pct}%` : "—" },
        { label: "FTP", value: resolvedFtp != null ? `${Math.round(resolvedFtp)} W` : "—" },
        { label: "FTP/kg", value: ftpPerKg != null ? ftpPerKg.toFixed(2) : "—" },
        {
          label: "LT1 / LT2",
          value: resolvedLt1 != null || resolvedLt2 != null ? `${resolvedLt1 ?? "—"} / ${resolvedLt2 ?? "—"} W` : "—",
        },
        { label: "Indice glic. (proxy)", value: resolvedVLamax != null ? `${resolvedVLamax.toFixed(2)}` : "—" },
        { label: "VO2max", value: derivedVo2max != null ? `${derivedVo2max.toFixed(1)} ml/kg/min` : "—" },
        { label: "FC riposo", value: currentProfile.resting_hr_bpm != null ? `${currentProfile.resting_hr_bpm} bpm` : "—" },
        { label: "FC max", value: currentProfile.max_hr_bpm != null ? `${currentProfile.max_hr_bpm} bpm` : "—" },
      ].map((m) => ({ ...m, accent: profileMetricLabelToAccent(m.label) }))
    : [];

  const twinKpiItems = twinSnapshot
    ? [
        { label: "Readiness", value: twinSnapshot.readiness != null ? `${Math.round(twinSnapshot.readiness)}` : "—", accent: "cyan" as const, icon: Heart },
        {
          label: "Fatigue (acute)",
          value: twinSnapshot.fatigueAcute != null ? twinSnapshot.fatigueAcute.toFixed(2) : "—",
          accent: "orange" as const,
          icon: Flame,
        },
        {
          label: "Fitness (chronic)",
          value: twinSnapshot.fitnessChronic != null ? twinSnapshot.fitnessChronic.toFixed(2) : "—",
          accent: "emerald" as const,
          icon: Activity,
        },
        {
          label: "Internal load",
          value: twinSnapshot.internalLoadIndex != null ? twinSnapshot.internalLoadIndex.toFixed(2) : "—",
          accent: "violet" as const,
          icon: GaugeCircle,
        },
        {
          label: "Recovery debt",
          value: twinSnapshot.recoveryDebt != null ? twinSnapshot.recoveryDebt.toFixed(2) : "—",
          accent: "slate" as const,
          icon: Layers,
        },
        {
          label: "Glycogen",
          value: twinSnapshot.glycogenStatus != null ? twinSnapshot.glycogenStatus.toFixed(2) : "—",
          accent: "cyan" as const,
          icon: Activity,
        },
      ]
    : [];

  const isCoachWithoutAthlete = role === "coach" && !activeAthleteId;

  return (
    <Pro2ModulePageShell
      eyebrow="Athlete · Profile"
      eyebrowClassName={moduleEyebrowClass("profile")}
      title="Identità e vincoli"
      description={<span className="text-sm text-gray-400">I tuoi dati, misure e preferenze alimentari.</span>}
      headerActions={
        currentProfile ? (
          <Pro2Button
            type="button"
            variant="secondary"
            className="border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
            onClick={() => startEditProfile(currentProfile)}
          >
            Modifica profilo
          </Pro2Button>
        ) : null
      }
    >
      <div className="profile-page space-y-10">
        {error ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div>
        ) : null}

        {currentProfile ? (
          <>
            <div className={cn("grid gap-6 lg:items-start", role === "private" ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
            <section className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/[0.12] via-orange-950/[0.08] to-black/85 p-4 shadow-inner sm:p-6">
              <div className="flex flex-wrap items-center gap-5">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-fuchsia-400/40 bg-fuchsia-500/25 text-xl font-black text-white shadow-[0_0_24px_rgba(217,70,239,0.3)]"
                  aria-hidden
                >
                  {(currentProfile.first_name?.[0] ?? currentProfile.last_name?.[0] ?? "U").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {[currentProfile.first_name, currentProfile.last_name].filter(Boolean).join(" ") || "Utente"}
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    {`${currentProfile.activity_level ?? "advanced"}${currentProfile.diet_type ? ` · ${currentProfile.diet_type}` : ""}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide",
                    athleteTypePillClass(athleteType.tone),
                  )}
                >
                  {athleteType.label}
                </span>
              </div>
            </section>

            {role === "private" ? (
              hasLinkedCoach ? (
                <Pro2SectionCard
                  accent="emerald"
                  icon={UserCheck}
                  title="Il tuo coach"
                  subtitle="Coach collegato al tuo profilo"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-400/40 bg-emerald-500/20 text-lg font-black text-white"
                      aria-hidden
                    >
                      {(linkedCoach?.name?.[0] ?? "C").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-white">{linkedCoach?.name ?? "Coach"}</p>
                      {linkedCoach?.email ? (
                        <p className="mt-0.5 break-all text-sm text-gray-400">{linkedCoach.email}</p>
                      ) : null}
                    </div>
                    <span className="inline-flex shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                      Collegato
                    </span>
                  </div>
                  <p className="mt-3 text-[0.8rem] leading-relaxed text-gray-500">
                    Hai già un coach collegato: puoi averne uno solo. Per cambiarlo, scrivi al supporto.
                  </p>
                </Pro2SectionCard>
              ) : (
                <InviteCoachCard />
              )
            ) : null}
            </div>

            <Pro2SectionCard
              accent="orange"
              icon={GaugeCircle}
              title="Metriche chiave"
              subtitle="I tuoi valori principali"
            >
              <ProfilePro2KpiGrid items={keyMetricItems} />
              {showTech ? (
                <p className="mt-3 text-[0.8rem] leading-relaxed text-gray-500">
                  FTP / indice glicolitico / VO₂max qui sono dall&apos;ultimo dato salvato su Supabase (snapshot Physiology). Per numeri col motore
                  attuale, apri Physiology → Metabolic Profile e premi &quot;Salva snapshot&quot;.
                </p>
              ) : null}
            </Pro2SectionCard>

            {showTech && physiologySummarySections.length ? (
              <Pro2SectionCard
                accent="cyan"
                icon={Activity}
                title="Segnali fisiologici"
                subtitle="Vista compatta da PhysiologyState in athlete memory"
              >
                <div className="space-y-6">
                  {physiologySummarySections.map((section) => (
                    <div key={section.title}>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{section.title}</p>
                      <p className="text-[0.65rem] text-gray-600">{section.cards.length} segnali</p>
                      <ProfilePro2KpiGrid
                        columnsClassName="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                        items={section.cards.map((card) => ({
                          label: card.label,
                          value: card.value,
                          accent: profileSectionTitleToAccent(section.title),
                          icon: Activity,
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </Pro2SectionCard>
            ) : null}

            {showTech && physiologyCoverage ? (
              <Pro2SectionCard
                accent="slate"
                icon={Dna}
                title="Copertura dataset fisiologico"
                subtitle="Cosa è presente in memoria per i motori deterministici"
              >
                <details className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-300">Fonti e derivazioni</summary>
                  <div className="mt-3 space-y-2 text-sm text-gray-400">
                    <p>
                      {`Profilo fisiologico ${physiologyCoverage.physiologicalProfile ? "ok" : "mancante"} · run metabolico ${physiologyCoverage.metabolicRun ? "ok" : "mancante"} · lattato ${physiologyCoverage.lactateRun ? "ok" : "mancante"} · performance ${physiologyCoverage.performanceRun ? "ok" : "mancante"} · bioenergetica ${physiologyCoverage.biomarkerPanel ? "ok" : "mancante"}`}
                    </p>
                    <p>
                      {`VO2max · ${vo2maxSourceLabel}${derivedVo2max != null ? ` · ${derivedVo2max.toFixed(1)} ml/kg/min` : ""}`}
                    </p>
                  </div>
                </details>
              </Pro2SectionCard>
            ) : null}

            {showTech && twinSnapshot ? (
              <Pro2SectionCard
                accent="violet"
                icon={Layers}
                title="Digital twin"
                subtitle={
                  twinSnapshot.asOf
                    ? `Aggiornato ${String(twinSnapshot.asOf).slice(0, 10)}`
                    : "Stato unificato atleta"
                }
              >
                <ProfilePro2KpiGrid items={twinKpiItems} />
              </Pro2SectionCard>
            ) : null}
          </>
        ) : null}

      {isCoachWithoutAthlete ? (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-5 py-4 text-sm text-slate-200">
          <p className="font-semibold text-violet-100">Account coach</p>
          <p className="mt-1 leading-relaxed text-slate-400">
            Il profilo atleta non si gestisce da qui. I tuoi atleti sono in Atleti.
          </p>
          <div className="mt-3">
            <Pro2Link href="/athletes" variant="secondary" className="justify-center border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/15">
              Vai ad Atleti
            </Pro2Link>
          </div>
        </div>
      ) : !showForm && !currentProfile ? (
        <div>
          <Pro2Button
            type="button"
            variant="secondary"
            className="border border-white/20 bg-white/5 hover:bg-white/10"
            onClick={() => setShowForm(true)}
          >
            Crea il tuo profilo
          </Pro2Button>
        </div>
      ) : null}

      {!isCoachWithoutAthlete && showForm && (
        <div
          ref={editorScrollRef}
          className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Modifica profilo"
        >
          {/* Blocca lo scroll della pagina di sfondo mentre il modale è aperto:
              elimina la seconda scrollbar (quella del documento html/body). */}
          <style>{`html,body{overflow:hidden!important}`}</style>
          <div
            className="min-h-full px-3 py-6 sm:px-6 sm:py-10"
            onClick={() => {
              setShowForm(false);
              setEditingProfileId(null);
            }}
          >
            <div className="relative mx-auto w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label="Chiudi editor"
                onClick={() => {
                  setShowForm(false);
                  setEditingProfileId(null);
                }}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-gray-300 transition hover:bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
              <Pro2SectionCard
                accent="slate"
                icon={PencilLine}
                title="Editor profilo"
                subtitle="Modifica i tuoi dati"
              >
        <div className="sticky top-0 z-10 mb-5 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/85 max-sm:bg-black p-2 backdrop-blur">
          <button type="button" className={editorTabClass(activeSection === "personal", "violet")} onClick={() => goToEditorSection("personal")}>Personale</button>
          <button type="button" className={editorTabClass(activeSection === "physical", "cyan")} onClick={() => goToEditorSection("physical")}>Fisico</button>
          <button type="button" className={editorTabClass(activeSection === "routine", "amber")} onClick={() => goToEditorSection("routine")}>Routine</button>
          <button type="button" className={editorTabClass(activeSection === "nutrition", "rose")} onClick={() => goToEditorSection("nutrition")}>Alimentazione</button>
          <button type="button" className={editorTabClass(activeSection === "devices", "slate")} onClick={() => goToEditorSection("devices")}>Devices</button>
        </div>
        <form onSubmit={handleSubmit} className={`profile-monitor profile-editor-shell tone-${profileToneForEditorSection(activeSection)} p-4 sm:p-5`}>
          <div className="pt-4 sm:pt-5">
          {activeSection === "personal" && <ProfilePersonalSection form={form} setForm={setForm} />}

          <ProfileDevicesSection
            activeAthleteId={activeAthleteId}
            hasActivePlan={hasActivePlan}
            active={activeSection === "devices"}
          />

          {activeSection === "physical" && <ProfilePhysicalSection form={form} setForm={setForm} />}

          {activeSection === "routine" && (
            <ProfileRoutineSection
              form={form}
              setForm={setForm}
              routineWeekPlan={routineWeekPlan}
              setRoutineWeekPlan={setRoutineWeekPlan}
              activeRoutineDay={activeRoutineDay}
              setActiveRoutineDay={setActiveRoutineDay}
              updateRoutineDay={updateRoutineDay}
            />
          )}

          {activeSection === "nutrition" && (
            <ProfileNutritionSection
              form={form}
              setForm={setForm}
              dietWeekPlan={dietWeekPlan}
              setDietWeekPlan={setDietWeekPlan}
              activeDietDay={activeDietDay}
              setActiveDietDay={setActiveDietDay}
              activeNutritionTab={activeNutritionTab}
              setActiveNutritionTab={setActiveNutritionTab}
              activeSupplementCategory={activeSupplementCategory}
              setActiveSupplementCategory={setActiveSupplementCategory}
              updateDietDay={updateDietDay}
            />
          )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Pro2Button type="submit" disabled={saving} variant="primary">
              {saving ? "Salvataggio…" : editingProfileId ? "Aggiorna profilo" : "Salva profilo"}
            </Pro2Button>
            <Pro2Button
              type="button"
              variant="secondary"
              className="border border-white/20 bg-white/5 hover:bg-white/10"
              onClick={() => {
                setShowForm(false);
                setEditingProfileId(null);
              }}
            >
              Annulla
            </Pro2Button>
          </div>
        </form>
              </Pro2SectionCard>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Caricamento dati profilo…</p>
      ) : !activeAthleteId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
          {role === "coach" ? "Nessun atleta attivo. Selezionalo in Athletes." : "Profilo atleta non disponibile per questo account."}
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100/90">
          {error === "Athlete access denied" ? (
            <span>
              L&apos;atleta attivo non è associato correttamente all&apos;utente corrente. Riesegui il login da <code className="text-amber-200/80">/access</code> per riallineare il profilo, oppure se sei coach seleziona un assistito valido in <code className="text-amber-200/80">/athletes</code>.
            </span>
          ) : (
            <span>
              Nessun profilo disponibile per l&apos;atleta attivo. Se il problema persiste, verifica il collegamento tra <code className="text-amber-200/80">app_user_profiles</code> e <code className="text-amber-200/80">athlete_profiles</code> in Supabase.
            </span>
          )}
        </div>
      ) : null}

      <PlatformAdminOnly>
        <Pro2SectionCard
          accent="slate"
          icon={Settings2}
          title="Diagnostica · admin"
          subtitle="Sessione, atleta, integrazioni, billing — visibile solo a operatori piattaforma"
        >
          <div className="flex flex-col gap-10">
            <SettingsBuildPhasesCard />
            <SettingsAuthSessionDiagnostics />
            <SettingsAthleteContextDiagnostics />
            <SettingsIntegrationsDiagnostics />
            <SettingsBillingDiagnostics />
          </div>
        </Pro2SectionCard>
      </PlatformAdminOnly>
      </div>
    </Pro2ModulePageShell>
  );
}

