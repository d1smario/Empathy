"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  WeekDay,
  DietDayConfig,
  ExcludedFdcFood,
  dietOptions,
  preferredCuisines,
  weekDays,
  toggleCsvToken,
} from "@/lib/profile/profile-page-kit";
import { ALLERGEN_CLASS_CATALOG } from "@/lib/nutrition/allergen-class-catalog";
import {
  findSupplementCategory,
  normalizeSupplementCategoryId,
  SUPPLEMENT_BRANDS,
  SUPPLEMENT_CATEGORIES,
} from "@/lib/profile/supplement-category-catalog";
import {
  NUTRITION_STRATEGY_INTENSITIES,
  resolveWeekStrategy,
  strategyToDayTypePct,
  strategyToDayTypePreset,
  type NutritionStrategy,
  type NutritionStrategyKind,
} from "@/lib/profile/nutrition-strategy";
import {
  csvTokens,
  toggleLegacyRemoval,
  type LegacyExclusionField,
  type LegacyExclusionRemovals,
  type ProfileFormState,
} from "@/modules/profile/views/sections/profile-form-state";

/**
 * Sezione "Alimentazione" dell'editor profilo (decomposizione del God-component).
 * Render-only: stato (form + piano settimanale dieta + tab nutrition/categoria
 * integratori) nel padre, passato via props; gli handler centralizzati restano nel padre.
 *
 * MODELLO (generativo attivo per tutti): l'atleta dichiara la sua ROUTINE (tab Routine)
 * e COSA NON MANGIA (tab Intolleranze); il coach dichiara SOLO la strategia calorica di
 * fase. Numero pasti, macro e grammature li ricalcola il motore ogni giorno dal consumo
 * reale, quindi qui non ci sono più manopole per distribuzione calorica, macro
 * giornalieri, macro per pasto, numero pasti o tipologia giorno.
 */
export type ProfileNutritionSectionProps = {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  dietWeekPlan: Record<WeekDay, DietDayConfig>;
  setDietWeekPlan: Dispatch<SetStateAction<Record<WeekDay, DietDayConfig>>>;
  activeNutritionTab: "diet" | "intolerances" | "supplements";
  setActiveNutritionTab: Dispatch<SetStateAction<"diet" | "intolerances" | "supplements">>;
  activeSupplementCategory: string;
  setActiveSupplementCategory: Dispatch<SetStateAction<string>>;
  /**
   * Stesso gate delle % nutrizionali (coach o platform admin): è la sola cosa che il
   * coach decide nel modello nuovo — la strategia calorica. Per l'atleta la sezione è
   * in sola lettura (vede quale fase è attiva, non la cambia); il server rifà lo stesso
   * controllo in `sanitize-nutrition-config-percents`.
   */
  canEditNutritionPercents?: boolean;
  /** Esclusioni-cibo strutturate dal DB (globali): nutrition_config.excluded_fdc_foods */
  excludedFdcFoods: ExcludedFdcFood[];
  setExcludedFdcFoods: Dispatch<SetStateAction<ExcludedFdcFood[]>>;
  /** Classi allergeniche/intolleranze escluse (globali): nutrition_config.excluded_food_classes */
  excludedFoodClasses: string[];
  setExcludedFoodClasses: Dispatch<SetStateAction<string[]>>;
  /**
   * Voci storiche marcate per la rimozione, applicate SOLO dal salvataggio del padre.
   * Tenerle fuori da `form` è ciò che rende la × annullabile (vedi profile-form-state).
   */
  legacyExclusionRemovals: LegacyExclusionRemovals;
  setLegacyExclusionRemovals: Dispatch<SetStateAction<LegacyExclusionRemovals>>;
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
  activeNutritionTab,
  setActiveNutritionTab,
  activeSupplementCategory,
  setActiveSupplementCategory,
  canEditNutritionPercents = true,
  excludedFdcFoods,
  setExcludedFdcFoods,
  excludedFoodClasses,
  setExcludedFoodClasses,
  legacyExclusionRemovals,
  setLegacyExclusionRemovals,
}: ProfileNutritionSectionProps) {
  const t = useTranslations("ProfileNutritionSection");
  const locale = useLocale();

  // STRATEGIA: la fase calorica è una scelta di settimana, non di giorno, ma il dato
  // resta per-giorno (`week_plan[gg].day_type_pct`, forma invariata → zero migrazioni).
  // In lettura si risolve la strategia dei sette giorni; in scrittura si applica a tutti.
  const strategy = resolveWeekStrategy(weekDays.map((day) => dietWeekPlan[day].day_type_pct));
  const strategyPct = strategyToDayTypePct(strategy);

  function applyStrategy(next: NutritionStrategy) {
    const day_type_pct = strategyToDayTypePct(next);
    const day_type = strategyToDayTypePreset(next);
    setDietWeekPlan((prev) => {
      const out = { ...prev };
      for (const day of weekDays) out[day] = { ...prev[day], day_type_pct, day_type };
      return out;
    });
  }

  function selectStrategyKind(kind: NutritionStrategyKind) {
    if (kind === "normocaloric") {
      applyStrategy({ kind, intensityPct: null });
      return;
    }
    // Passando da ipo a iper (o viceversa) si conserva l'intensità già scelta.
    applyStrategy({ kind, intensityPct: strategy.intensityPct ?? 5 });
  }

  // `t` con chiave calcolata non è tipizzabile: switch esplicito.
  function strategyKindLabel(kind: NutritionStrategyKind): string {
    if (kind === "hypocaloric") return t("strategyHypocaloric");
    if (kind === "hypercaloric") return t("strategyHypercaloric");
    return t("strategyNormocaloric");
  }

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

  // ESCLUSIONI STORICHE (`athlete_profiles.intolerances` / `food_exclusions`): non si
  // scrivono più da qui — classi e picker le fanno meglio — ma restano LEGGIBILI e
  // TOGLIBILI, per due motivi:
  //  1. i profili vecchi hanno valori che il motore applica ancora
  //     (`buildMealPlanFoodDenyFragments` li espande in frammenti di deny) e che l'atleta
  //     rivede stampati nel modulo Nutrizione («Intolleranze dichiarate: …»);
  //  2. `food_exclusions` ha ancora uno scrittore vivo — il bottone staff «escludi dal
  //     profilo» nella scheda pasto (NutritionPageView → persistFoodExclusionToProfile)
  //     ci APPENDE l'etichetta del cibo tolto dal piano.
  // Senza questo pannello quella lista sarebbe un cricchetto a senso unico: cresce e non
  // si può più svuotare da nessuna superficie. Il pannello compare solo se c'è qualcosa.
  //
  // La × NON tocca `form`: marca il token in `legacyExclusionRemovals` (stato del padre) e
  // il chip diventa barrato con un bottone «ripristina». Il dato sparisce dal DB solo al
  // Salva — che sull'ultimo token scrive NULL sulla colonna e non è più recuperabile da
  // nessuna UI: per questo la rimozione dev'essere annullabile fino a lì.
  const legacyIntolerances = csvTokens(form.intolerances);
  const legacyFoodExclusions = csvTokens(form.food_exclusions);
  const legacyExclusionChips: { field: LegacyExclusionField; token: string }[] = [
    ...legacyIntolerances.map((token) => ({ field: "intolerances" as const, token })),
    ...legacyFoodExclusions.map((token) => ({ field: "food_exclusions" as const, token })),
  ];
  const pendingLegacyRemovalCount =
    legacyExclusionRemovals.intolerances.length + legacyExclusionRemovals.food_exclusions.length;

  function toggleLegacyToken(field: LegacyExclusionField, token: string) {
    setLegacyExclusionRemovals((prev) => toggleLegacyRemoval(prev, field, token));
  }

  return (
    <div>
      <div className="page-tabs theme-multi profile-editor-subtabs" style={{ marginBottom: "24px" }}>
        <button type="button" className={`page-tab ${activeNutritionTab === "diet" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("diet")}>{t("tabStrategy")}</button>
        <button type="button" className={`page-tab ${activeNutritionTab === "intolerances" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("intolerances")}>{t("tabIntolerances")}</button>
        <button type="button" className={`page-tab ${activeNutritionTab === "supplements" ? "page-tab-active" : ""}`} onClick={() => setActiveNutritionTab("supplements")}>{t("tabSupplements")}</button>
      </div>

      {activeNutritionTab === "diet" && (
        <div>
          <div className="profile-subpanel tone-amber" style={{ marginBottom: "16px" }}>
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("strategyTitle")}</h4>

            {canEditNutritionPercents ? (
              <>
                <p className="text-[11px] text-slate-400" style={{ marginBottom: "10px" }}>{t("strategyCoachHint")}</p>
                <div className="profile-chip-grid">
                  {(["hypocaloric", "normocaloric", "hypercaloric"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={`profile-black-chip ${strategy.kind === kind ? "active" : ""}`}
                      aria-pressed={strategy.kind === kind}
                      onClick={() => selectStrategyKind(kind)}
                    >
                      {strategyKindLabel(kind)}
                    </button>
                  ))}
                </div>

                {strategy.kind !== "normocaloric" ? (
                  <div style={{ marginTop: "12px" }}>
                    {/* Gruppo di chip, non un input: `div` con lo stile label (un <label> senza controllo associato). */}
                    <div className="form-label">{t("strategyIntensityLabel")}</div>
                    <div className="profile-chip-grid" role="group" aria-label={t("strategyIntensityLabel")}>
                      {NUTRITION_STRATEGY_INTENSITIES.map((intensityPct) => (
                        <button
                          key={intensityPct}
                          type="button"
                          className={`profile-black-chip ${strategy.intensityPct === intensityPct ? "active" : ""}`}
                          aria-pressed={strategy.intensityPct === intensityPct}
                          onClick={() => applyStrategy({ kind: strategy.kind, intensityPct })}
                        >
                          {strategy.kind === "hypocaloric" ? `−${intensityPct}%` : `+${intensityPct}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <p className="text-[11px] text-slate-400" style={{ marginTop: "12px" }}>
                  {t("strategyCurrentPct", { pct: strategyPct })}
                </p>
              </>
            ) : (
              <>
                <p style={{ marginBottom: "8px" }}>
                  <strong>{strategyKindLabel(strategy.kind)}</strong>
                  {" · "}
                  {t("strategyCurrentPct", { pct: strategyPct })}
                </p>
                <p className="text-[11px] text-slate-400">{t("strategyAthleteExplainer")}</p>
              </>
            )}
          </div>

          <div className="form-group"><label className="form-label">{t("dietType")}</label><select className="form-select profile-dark-select" value={form.diet_type} onChange={(e) => setForm((f) => ({ ...f, diet_type: e.target.value }))}>{dietOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="form-group"><label className="form-label">{t("preferredCuisines")}</label></div>
          <div className="profile-chip-grid">
            {preferredCuisines.map((c) => {
              const selected = form.cuisines.split(",").map((s) => s.trim()).filter(Boolean).includes(c);
              return (
                <button key={c} type="button" className={`profile-black-chip ${selected ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, cuisines: toggleCsvToken(f.cuisines, c) }))}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeNutritionTab === "intolerances" && (
        <div>
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

            {/* Chip rimovibili: NON `.profile-black-chip` (è una griglia a colonne fisse con
                `white-space: nowrap` sotto i 480px → con le etichette del catalogo, che
                arrivano a 30 caratteri, la × finiva tagliata fuori dal box) e non un <span>
                con `cursor: pointer` addosso, che fa sembrare cliccabile tutto il chip. */}
            {excludedFdcFoods.length > 0 ? (
              <div className="profile-removable-chip-row" style={{ marginTop: "16px" }}>
                {excludedFdcFoods.map((food) => (
                  <span key={food.fdcId} className="profile-removable-chip active">
                    <span className="profile-removable-chip-label">{food.label}</span>
                    <button
                      type="button"
                      className="profile-removable-chip-btn"
                      onClick={() => removeExcludedFood(food.fdcId)}
                      aria-label={t("excludedFdcFoodsRemoveAria", { label: food.label })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Solo REAZIONI (allergie e intolleranze), di proposito — mai i gusti. Il testo
              scritto qui finisce in `athlete_profiles.allergies`, che il modulo Nutrizione
              ripete VERBATIM all'atleta come pillola «Allergie e intolleranze: …»
              (lib/nutrition/nutrition-adaptation-sector-strip.ts): invitare a scriverci
              «cipolla perché non mi piace» produrrebbe la bugia «Allergie e intolleranze:
              cipolla». Un cibo semplicemente sgradito si toglie col picker qui sopra, che
              non alimenta quella pillola. Il campo resta perché le 8 classi di
              ALLERGEN_CLASS_CATALOG non coprono tutte le famiglie che il motore sa
              espandere (crostacei, sesamo, senape, sedano, mais non hanno una classe) né
              le intolleranze fuori catalogo (fruttosio, sorbitolo, nichel): il motore le
              tratta comunque tutte allo stesso modo, `buildMealPlanFoodDenyFragments`
              unisce allergies + intolerances + food_exclusions in un unico deny. */}
          <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
            <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("otherAllergensLabel")}</h4>
            <p className="text-[11px] text-slate-400" style={{ marginBottom: "10px" }}>{t("otherAllergensHint")}</p>
            <div className="form-group">
              <input
                className="form-input"
                type="text"
                value={form.allergies}
                onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                placeholder={t("otherAllergensPlaceholder")}
                aria-label={t("otherAllergensLabel")}
              />
            </div>
          </div>

          {legacyExclusionChips.length > 0 ? (
            <div className="profile-subpanel tone-amber" style={{ marginBottom: "12px" }}>
              <h4 className="profile-editor-subtitle"><span className="profile-kpi-dot" />{t("legacyExclusionsLabel")}</h4>
              <p className="text-[11px] text-slate-400" style={{ marginBottom: "10px" }}>{t("legacyExclusionsHint")}</p>
              <div className="profile-removable-chip-row">
                {legacyExclusionChips.map(({ field, token }) => {
                  const marked = legacyExclusionRemovals[field].includes(token);
                  return (
                    <span
                      key={`${field}:${token}`}
                      className={`profile-removable-chip ${marked ? "removed" : "active"}`}
                    >
                      <span className="profile-removable-chip-label">{token}</span>
                      <button
                        type="button"
                        className="profile-removable-chip-btn"
                        onClick={() => toggleLegacyToken(field, token)}
                        aria-pressed={marked}
                        aria-label={
                          marked
                            ? t("legacyExclusionsRestoreAria", { label: token })
                            : t("legacyExclusionsRemoveAria", { label: token })
                        }
                      >
                        {marked ? "↩" : "×"}
                      </button>
                    </span>
                  );
                })}
              </div>
              {pendingLegacyRemovalCount > 0 ? (
                <p className="text-[11px] text-amber-300" style={{ marginTop: "10px" }}>
                  {t("legacyExclusionsPendingHint", { count: pendingLegacyRemovalCount })}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* QUANDO fa effetto, detto una volta per tutti e quattro i pannelli del tab.
              Sotto read-first (NutritionPageView: input solver cambiati → si RILEGGE il
              persistito, non si rigenera) il piano già salvato resta com'è; l'atleta non ha
              nemmeno il bottone «Rigenera piano», che è gated su platformAdminView
              (MealPlanSection). A rifare i piani sono l'auto-generazione dei giorni ancora
              privi di piano e il cron di ripianificazione settimanale, che riscrive la
              settimana SUCCESSIVA (runWeeklyReplan). Promettere altro sarebbe una bugia. */}
          <p className="text-[11px] text-slate-400" style={{ marginBottom: "12px" }}>{t("exclusionsTimingNote")}</p>

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
