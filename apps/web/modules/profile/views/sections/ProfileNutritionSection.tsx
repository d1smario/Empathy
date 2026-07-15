"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  WeekDay,
  DietDayConfig,
  ExcludedFdcFood,
  dietOptions,
  weekDays,
  toggleCsvToken,
  defaultPctForDayType,
} from "@/lib/profile/profile-page-kit";
import { ALLERGEN_CLASS_CATALOG } from "@/lib/nutrition/allergen-class-catalog";
import {
  findSupplementCategory,
  normalizeSupplementCategoryId,
  SUPPLEMENT_BRANDS,
  SUPPLEMENT_CATEGORIES,
} from "@/lib/profile/supplement-category-catalog";
import { resolveSixMealSnackPercentages } from "@/lib/nutrition/diet-meal-slot-budgets";
import type { ProfileFormState } from "@/modules/profile/views/sections/profile-form-state";

/**
 * Sezione "Alimentazione" dell'editor profilo (decomposizione del God-component).
 * Render-only: stato (form + piano settimanale dieta + tab nutrition/categoria
 * integratori) nel padre, passato via props; gli handler centralizzati
 * (updateDietDay, save) restano nel padre.
 */
export type ProfileNutritionSectionProps = {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  dietWeekPlan: Record<WeekDay, DietDayConfig>;
  setDietWeekPlan: Dispatch<SetStateAction<Record<WeekDay, DietDayConfig>>>;
  activeDietDay: WeekDay;
  setActiveDietDay: Dispatch<SetStateAction<WeekDay>>;
  activeNutritionTab: "diet" | "intolerances" | "supplements";
  setActiveNutritionTab: Dispatch<SetStateAction<"diet" | "intolerances" | "supplements">>;
  activeSupplementCategory: string;
  setActiveSupplementCategory: Dispatch<SetStateAction<string>>;
  updateDietDay: (day: WeekDay, patch: Partial<DietDayConfig>) => void;
  /** Esclusioni-cibo strutturate dal DB (globali): nutrition_config.excluded_fdc_foods */
  excludedFdcFoods: ExcludedFdcFood[];
  setExcludedFdcFoods: Dispatch<SetStateAction<ExcludedFdcFood[]>>;
  /** Classi allergeniche/intolleranze escluse (globali): nutrition_config.excluded_food_classes */
  excludedFoodClasses: string[];
  setExcludedFoodClasses: Dispatch<SetStateAction<string[]>>;
};

/** Item della risposta /api/nutrition/food-lookup (solo i campi usati qui). */
type FoodLookupResult = {
  fdcId: number | null;
  label: string;
  brand: string | null;
  kcal_100: number | null;
};

export function ProfileNutritionSection({
  form,
  setForm,
  dietWeekPlan,
  setDietWeekPlan,
  activeDietDay,
  setActiveDietDay,
  activeNutritionTab,
  setActiveNutritionTab,
  activeSupplementCategory,
  setActiveSupplementCategory,
  updateDietDay,
  excludedFdcFoods,
  setExcludedFdcFoods,
  excludedFoodClasses,
  setExcludedFoodClasses,
}: ProfileNutritionSectionProps) {
  const t = useTranslations("ProfileNutritionSection");
  const locale = useLocale();
  void setDietWeekPlan;

  // «Alimenti da evitare (dal database)»: ricerca nel nostro DB via
  // /api/nutrition/food-lookup, stessa logica del picker pasti (debounce →
  // lista risultati → click per aggiungere). Solo cibi con fdcId numerico.
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodLookupResult[]>([]);
  const [foodSearching, setFoodSearching] = useState(false);
  const [foodSearched, setFoodSearched] = useState(false);

  useEffect(() => {
    const q = foodQuery.trim();
    if (q.length < 2) {
      setFoodResults([]);
      setFoodSearching(false);
      setFoodSearched(false);
      return;
    }
    let cancelled = false;
    setFoodSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nutrition/food-lookup?q=${encodeURIComponent(q)}`, { method: "GET" });
        const payload = (await res.json()) as { items?: FoodLookupResult[] };
        if (cancelled) return;
        const items = Array.isArray(payload.items) ? payload.items : [];
        setFoodResults(
          items
            .filter((i) => typeof i.fdcId === "number" && Number.isFinite(i.fdcId) && Boolean(i.label))
            .slice(0, 8),
        );
      } catch {
        if (!cancelled) setFoodResults([]);
      } finally {
        if (!cancelled) {
          setFoodSearching(false);
          setFoodSearched(true);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [foodQuery]);

  function addExcludedFood(item: FoodLookupResult) {
    if (typeof item.fdcId !== "number" || !Number.isFinite(item.fdcId)) return;
    const fdcId = item.fdcId;
    const label = item.label.trim();
    if (!label) return;
    setExcludedFdcFoods((prev) => (prev.some((f) => f.fdcId === fdcId) ? prev : [...prev, { fdcId, label }]));
    setFoodQuery("");
    setFoodResults([]);
    setFoodSearched(false);
  }

  function removeExcludedFood(fdcId: number) {
    setExcludedFdcFoods((prev) => prev.filter((f) => f.fdcId !== fdcId));
  }

  function toggleFoodClass(key: string) {
    setExcludedFoodClasses((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  return (
    <div>
      <div className="page-tabs theme-multi profile-editor-subtabs" style={{ marginBottom: "24px" }}>
        <button type="button" className={`page-tab ${activeNutritionTab === "diet" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("diet")}>{t("tabDiet")}</button>
        <button type="button" className={`page-tab ${activeNutritionTab === "intolerances" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("intolerances")}>{t("tabIntolerances")}</button>
        <button type="button" className={`page-tab ${activeNutritionTab === "supplements" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("supplements")}>{t("tabSupplements")}</button>
      </div>

      {activeNutritionTab === "diet" && (
        <div>
          <div className="form-group"><label className="form-label">{t("dietType")}</label><select className="form-select profile-dark-select" value={form.diet_type} onChange={(e) => setForm((f) => ({ ...f, diet_type: e.target.value }))}>{dietOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="form-group"><label className="form-label">{t("preferredCuisines")}</label></div>
          <div className="profile-chip-grid">
            {["mediterranea", "asiatica", "thai", "messicana", "nordic"].map((c) => {
              const selected = form.cuisines.split(",").map((s) => s.trim()).filter(Boolean).includes(c);
              return (
                <button key={c} type="button" className={`profile-black-chip ${selected ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, cuisines: toggleCsvToken(f.cuisines, c) }))}>
                  {c}
                </button>
              );
            })}
          </div>

          <div className="profile-day-strip" style={{ marginTop: "12px" }}>
            {weekDays.map((day) => (
              <button key={day} type="button" className={`profile-day-chip ${activeDietDay === day ? "active" : ""}`} onClick={() => setActiveDietDay(day)}>{day}</button>
            ))}
          </div>

          <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
            <div className="profile-editor-grid">
              <div className="form-group"><label className="form-label">{t("mealCountFasting")}</label><select className="form-select profile-dark-select" value={dietWeekPlan[activeDietDay].meal_count_mode} onChange={(e) => {
                const meal_count_mode = e.target.value as DietDayConfig["meal_count_mode"];
                if (meal_count_mode === "6") {
                  const c = dietWeekPlan[activeDietDay].caloric_distribution;
                  const r = resolveSixMealSnackPercentages(c);
                  updateDietDay(activeDietDay, {
                    meal_count_mode,
                    caloric_distribution: {
                      ...c,
                      snack_am: r.snack_am,
                      snack_pm: r.snack_pm,
                      snack_evening: r.snack_evening,
                      snacks: r.snacksTotal,
                    },
                  });
                } else {
                  updateDietDay(activeDietDay, { meal_count_mode });
                }
              }}><option value="1">{t("oneMeal")}</option><option value="2">{t("twoMeals")}</option><option value="3">{t("threeMeals")}</option><option value="4">{t("fourMeals")}</option><option value="5">{t("fiveMeals")}</option><option value="6">{t("sixMeals")}</option><option value="fasting">{t("fasting")}</option><option value="semi-8-16">{t("semiFasting816")}</option><option value="semi-6-18">{t("semiFasting618")}</option><option value="semi-4-20">{t("semiFasting420")}</option></select></div>
              <div className="form-group"><label className="form-label">{t("dayType")}</label><select className="form-select profile-dark-select" value={dietWeekPlan[activeDietDay].day_type} onChange={(e) => { const day_type = e.target.value as DietDayConfig["day_type"]; updateDietDay(activeDietDay, { day_type, day_type_pct: defaultPctForDayType(day_type) }); }}><option value="fasting-0">{t("dayTypeFasting")}</option><option value="severe-15-30">{t("dayTypeSevere")}</option><option value="catabolic-50-99">{t("dayTypeCatabolic")}</option><option value="normocaloric-100">{t("dayTypeNormocaloric")}</option><option value="anabolic-101-130">{t("dayTypeAnabolic")}</option></select></div>
              <div className="form-group"><label className="form-label">{t("pctCaloriesVsRequirement")}</label><input className="form-input" type="number" min={0} max={130} value={dietWeekPlan[activeDietDay].day_type_pct} onChange={(e) => updateDietDay(activeDietDay, { day_type_pct: Number(e.target.value || 0) })} /></div>
            </div>
          </div>

          <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("mealCaloricDistribution")}</h4>
            <div className="profile-editor-grid profile-editor-grid-compact">
              <div className="form-group"><label className="form-label">{t("breakfast")}</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.breakfast} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, breakfast: Number(e.target.value || 0) } })} /></div>
              <div className="form-group"><label className="form-label">{t("lunch")}</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.lunch} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, lunch: Number(e.target.value || 0) } })} /></div>
              <div className="form-group"><label className="form-label">{t("dinner")}</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.dinner} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, dinner: Number(e.target.value || 0) } })} /></div>
              {dietWeekPlan[activeDietDay].meal_count_mode === "6" ? (
                <>
                  <div className="form-group"><label className="form-label">{t("snackMorning")}</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snack_am ?? 10} onChange={(e) => {
                    const snack_am = Number(e.target.value || 0);
                    const snack_pm = dietWeekPlan[activeDietDay].caloric_distribution.snack_pm ?? 10;
                    const snack_evening = dietWeekPlan[activeDietDay].caloric_distribution.snack_evening ?? 10;
                    updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snack_am, snack_pm, snack_evening, snacks: snack_am + snack_pm + snack_evening } });
                  }} /></div>
                  <div className="form-group"><label className="form-label">{t("snackAfternoon")}</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snack_pm ?? 10} onChange={(e) => {
                    const snack_pm = Number(e.target.value || 0);
                    const snack_am = dietWeekPlan[activeDietDay].caloric_distribution.snack_am ?? 10;
                    const snack_evening = dietWeekPlan[activeDietDay].caloric_distribution.snack_evening ?? 10;
                    updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snack_am, snack_pm, snack_evening, snacks: snack_am + snack_pm + snack_evening } });
                  }} /></div>
                  <div className="form-group"><label className="form-label">{t("snackEvening")}</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snack_evening ?? 10} onChange={(e) => {
                    const snack_evening = Number(e.target.value || 0);
                    const snack_am = dietWeekPlan[activeDietDay].caloric_distribution.snack_am ?? 10;
                    const snack_pm = dietWeekPlan[activeDietDay].caloric_distribution.snack_pm ?? 10;
                    updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snack_am, snack_pm, snack_evening, snacks: snack_am + snack_pm + snack_evening } });
                  }} /></div>
                  <p className="col-span-full text-[11px] text-slate-400">{t("sixMealsSnackNote", { dayTotal: Math.round(dietWeekPlan[activeDietDay].caloric_distribution.breakfast + dietWeekPlan[activeDietDay].caloric_distribution.lunch + dietWeekPlan[activeDietDay].caloric_distribution.dinner + dietWeekPlan[activeDietDay].caloric_distribution.snacks) })}</p>
                </>
              ) : (
                <div className="form-group"><label className="form-label">{t("snacks")}</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].caloric_distribution.snacks} onChange={(e) => updateDietDay(activeDietDay, { caloric_distribution: { ...dietWeekPlan[activeDietDay].caloric_distribution, snacks: Number(e.target.value || 0) } })} /></div>
              )}
            </div>
          </div>

          <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("dailyMacronutrients")}</h4>
            <div className="profile-editor-grid profile-editor-grid-compact">
              <div className="form-group"><label className="form-label">CHO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].daily_macros.cho_pct} onChange={(e) => updateDietDay(activeDietDay, { daily_macros: { ...dietWeekPlan[activeDietDay].daily_macros, cho_pct: Number(e.target.value || 0) } })} /></div>
              <div className="form-group"><label className="form-label">PRO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].daily_macros.pro_pct} onChange={(e) => updateDietDay(activeDietDay, { daily_macros: { ...dietWeekPlan[activeDietDay].daily_macros, pro_pct: Number(e.target.value || 0) } })} /></div>
              <div className="form-group"><label className="form-label">FAT</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].daily_macros.fat_pct} onChange={(e) => updateDietDay(activeDietDay, { daily_macros: { ...dietWeekPlan[activeDietDay].daily_macros, fat_pct: Number(e.target.value || 0) } })} /></div>
            </div>
          </div>

          <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("customPerMealMacros")}</h4>
            <div className="profile-meal-macro-grid">
              {(["breakfast", "lunch", "dinner", "snacks"] as const).map((meal) => (
                <div key={meal} className="profile-meal-macro-card">
                  <strong>{meal}</strong>
                  <div className="form-group"><label className="form-label">CHO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].meal_macro_custom[meal].cho_pct} onChange={(e) => updateDietDay(activeDietDay, { meal_macro_custom: { ...dietWeekPlan[activeDietDay].meal_macro_custom, [meal]: { ...dietWeekPlan[activeDietDay].meal_macro_custom[meal], cho_pct: Number(e.target.value || 0) } } })} /></div>
                  <div className="form-group"><label className="form-label">PRO</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].meal_macro_custom[meal].pro_pct} onChange={(e) => updateDietDay(activeDietDay, { meal_macro_custom: { ...dietWeekPlan[activeDietDay].meal_macro_custom, [meal]: { ...dietWeekPlan[activeDietDay].meal_macro_custom[meal], pro_pct: Number(e.target.value || 0) } } })} /></div>
                  <div className="form-group"><label className="form-label">FAT</label><input className="form-input" type="number" min={0} max={100} value={dietWeekPlan[activeDietDay].meal_macro_custom[meal].fat_pct} onChange={(e) => updateDietDay(activeDietDay, { meal_macro_custom: { ...dietWeekPlan[activeDietDay].meal_macro_custom, [meal]: { ...dietWeekPlan[activeDietDay].meal_macro_custom[meal], fat_pct: Number(e.target.value || 0) } } })} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group"><label className="form-label">{t("foodPreferencesCsv")}</label><input className="form-input" type="text" value={form.food_preferences} onChange={(e) => setForm((f) => ({ ...f, food_preferences: e.target.value }))} /></div>
        </div>
      )}

      {activeNutritionTab === "intolerances" && (
        <div>
          <div className="form-group"><label className="form-label">{t("intolerancesCsv")}</label><input className="form-input" type="text" value={form.intolerances} onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">{t("allergiesCsv")}</label><input className="form-input" type="text" value={form.allergies} onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">{t("excludedFoodsCsv")}</label><input className="form-input" type="text" value={form.food_exclusions} onChange={(e) => setForm((f) => ({ ...f, food_exclusions: e.target.value }))} /></div>

          <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("excludedFoodClassesLabel")}</h4>
            <p className="text-[11px] text-slate-400" style={{ marginBottom: "10px" }}>{t("excludedFoodClassesHint")}</p>
            <div className="profile-chip-grid">
              {ALLERGEN_CLASS_CATALOG.map((cls) => {
                const selected = excludedFoodClasses.includes(cls.key);
                return (
                  <button
                    key={cls.key}
                    type="button"
                    className={`profile-black-chip ${selected ? "active" : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleFoodClass(cls.key)}
                  >
                    {locale.startsWith("en") ? cls.labelEn : cls.labelIt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("excludedFdcFoodsLabel")}</h4>
            <p className="text-[11px] text-slate-400" style={{ marginBottom: "10px" }}>{t("excludedFdcFoodsHint")}</p>
            <div className="form-group">
              <input
                className="form-input"
                type="text"
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder={t("excludedFdcFoodsSearchPlaceholder")}
                aria-label={t("excludedFdcFoodsLabel")}
              />
            </div>
            {foodSearching ? (
              <p className="text-[11px] text-slate-400">{t("excludedFdcFoodsSearching")}</p>
            ) : foodResults.length > 0 ? (
              <div className="profile-chip-grid" style={{ marginTop: "4px" }}>
                {foodResults.map((r) => (
                  <button
                    key={r.fdcId}
                    type="button"
                    className="profile-black-chip"
                    onClick={() => addExcludedFood(r)}
                  >
                    {[r.brand, r.label].filter(Boolean).join(" · ")}
                  </button>
                ))}
              </div>
            ) : foodSearched && foodQuery.trim().length >= 2 ? (
              <p className="text-[11px] text-slate-400">{t("excludedFdcFoodsNoResults")}</p>
            ) : null}

            {excludedFdcFoods.length > 0 ? (
              <div className="profile-chip-grid" style={{ marginTop: "16px" }}>
                {excludedFdcFoods.map((food) => (
                  <span
                    key={food.fdcId}
                    className="profile-black-chip active"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                  >
                    {food.label}
                    <button
                      type="button"
                      onClick={() => removeExcludedFood(food.fdcId)}
                      aria-label={t("excludedFdcFoodsRemoveAria", { label: food.label })}
                      style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: 0 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="alert-warning">{t("intolerancesWarning")}</div>
        </div>
      )}

      {activeNutritionTab === "supplements" && (
        <div>
          <h4 className="section-title" style={{ fontSize: "13px", opacity: 0.75, marginBottom: "10px" }}>{t("category")}</h4>
          <div className="page-tabs theme-multi profile-editor-subtabs" style={{ marginBottom: "28px" }}>
            {SUPPLEMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`page-tab ${normalizeSupplementCategoryId(activeSupplementCategory) === cat.id ? "page-tab-active" : ""}`}
                onClick={() => setActiveSupplementCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <h4 className="section-title" style={{ fontSize: "13px", opacity: 0.75, marginBottom: "10px" }}>{t("availableSupplements")}</h4>
          <div className="profile-chip-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "28px" }}>
            {(findSupplementCategory(activeSupplementCategory)?.items ?? []).map((item) => {
              const categoryId = normalizeSupplementCategoryId(activeSupplementCategory);
              const token = `${categoryId}:${item}`;
              const selected = form.supplements.split(",").map((s) => s.trim()).filter(Boolean).includes(token);
              return (
                <button key={item} type="button" className={`profile-black-chip ${selected ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, supplements: toggleCsvToken(f.supplements, token) }))}>
                  {item}
                </button>
              );
            })}
          </div>
          <h4 className="section-title" style={{ fontSize: "13px", opacity: 0.75, marginBottom: "10px" }}>{t("preferredBrands")}</h4>
          <div className="profile-chip-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "28px" }}>
            {SUPPLEMENT_BRANDS.map((brand) => {
              const selected = form.supplement_brands.split(",").map((s) => s.trim()).filter(Boolean).includes(brand);
              return (
                <button key={brand} type="button" className={`profile-black-chip ${selected ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, supplement_brands: toggleCsvToken(f.supplement_brands, brand) }))}>
                  {brand}
                </button>
              );
            })}
          </div>
          <div className="form-group"><label className="form-label">{t("selectedSupplementsCsv")}</label><textarea className="form-textarea" value={form.supplements} onChange={(e) => setForm((f) => ({ ...f, supplements: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">{t("selectedBrandsCsv")}</label><textarea className="form-textarea" value={form.supplement_brands} onChange={(e) => setForm((f) => ({ ...f, supplement_brands: e.target.value }))} /></div>
        </div>
      )}
    </div>
  );
}
