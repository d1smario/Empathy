"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Activity,
  Apple,
  Banana,
  Bed,
  Beef,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  Droplet,
  Droplets,
  Drumstick,
  Egg,
  Fish,
  Flame,
  Grape,
  Milk,
  Moon,
  Nut,
  Pill,
  Salad,
  ShoppingBag,
  Soup,
  Sunrise,
  Sun,
  TrendingUp,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { inferCanonicalFoodKeyPreferName } from "@/lib/nutrition/canonical-food-composition";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  approxMacrosForPlanItem,
  bandFromGi,
  estimatedItemGlycemicIndex,
  giBandLabelIt,
  parseGramsFromPortion,
  stimulusLabelFromAvgGi,
  weightedAvgGlycemicIndex,
  type GiBand,
} from "@/lib/nutrition/meal-exposition-helpers";
import type { IntelligentMealPlanItemOut } from "@/lib/nutrition/intelligent-meal-plan-types";

function looksLikeMultiIngredientPortionHint(hint: string): boolean {
  const s = hint.trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes("+") ||
    s.includes(" + ") ||
    s.includes(" / ") ||
    s.includes("mix") ||
    s.includes("smoothie") ||
    s.includes("bowl") ||
    s.includes("insalata") ||
    s.includes("piatto") ||
    s.includes("combo")
  );
}

/**
 * Icona-cibo deterministica dal nome (IT/EN): il dataset FDC locale non ha
 * foto (image_url vuoto su tutte le righe, verificato 2026-07), quindi il
 * thumb grande mostra un'icona coerente con l'alimento invece del placeholder
 * generico. Solo mapping per parole chiave, zero AI. Ordine = priorità.
 */
const FOOD_ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/uovo|uova|\begg/i, Egg],
  [/salmone|salmon|tonno|tuna|merluzzo|sgombro|orata|branzino|pesce|fish|gamber|shrimp/i, Fish],
  [/pollo|chicken|tacchino|turkey/i, Drumstick],
  [/manzo|beef|vitello|maiale|pork|bresaola|prosciutto|\bham\b|carne/i, Beef],
  [/latte|milk|yogurt|kefir|ricotta|formaggio|cheese|parmigiano|grana|mozzarella/i, Milk],
  [/croissant|cornetto|brioche/i, Croissant],
  [/biscott|cookie|fette biscottate/i, Cookie],
  [/riso|rice|pasta|pane|bread|crack|avena|\boat|cereal|quinoa|farro|orzo|couscous|patat|potato/i, Wheat],
  [/banana/i, Banana],
  [/mela|apple/i, Apple],
  [/carota|carrot|zucca|pumpkin/i, Carrot],
  [/insalata|salad|verdur|spinaci|broccol|zucchin|lattuga|contorno|vegetabl|pepero|pomodor|tomato/i, Salad],
  [/mandorl|noci|\bnut|almond|walnut|nocciol|anacard|pistacch|arachid|peanut|semi di|\bseed/i, Nut],
  [/aranc|limone|lemon|citrus|agrum|pompelmo|grapefruit/i, Citrus],
  [/\buva\b|grape\b/i, Grape],
  [/mirtill|berr|frutti di bosco|cilieg|cherry|fragol|marmellata|\bjam\b/i, Cherry],
  [/olio|\boil\b|burro|butter|avocado/i, Droplet],
  [/caff|coffee|\btè\b|\btea\b/i, Coffee],
  [/zuppa|minestra|soup|brodo|vellutata/i, Soup],
  [/integrazion|integrator|supplement|whey|niacin|omega|vitamin|creatin|magnesio|ferro\b/i, Pill],
];

function foodItemIcon(name: string): LucideIcon {
  for (const [re, icon] of FOOD_ICON_RULES) {
    if (re.test(name)) return icon;
  }
  return Apple;
}

/**
 * Mappa `canonicalKey → imageUrl` (foto reale del cibo) da
 * `/api/nutrition/food-image-map`: specifica per alimento → immagine categoria →
 * assente. Cache di modulo: la mappa è uguale per tutti e cambia di rado, quindi
 * una sola fetch cross-mount. Se manca (bucket vuoto / no service key) resta {}
 * e il thumb cade sull'icona lucide — nessuna regressione.
 */
let foodImageMapCache: Record<string, string> | null = null;
let foodImageMapPromise: Promise<Record<string, string>> | null = null;

function loadFoodImageMap(): Promise<Record<string, string>> {
  if (foodImageMapCache) return Promise.resolve(foodImageMapCache);
  if (!foodImageMapPromise) {
    // `no-store`: la cache di modulo deduplica già a 1 fetch per sessione tab;
    // bypassare la cache HTTP (max-age=300) fa sì che aggiornamenti alle foto
    // (nuove image_url) compaiano al reload successivo invece che dopo 5 min.
    foodImageMapPromise = fetch("/api/nutrition/food-image-map", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { byKey: {} }))
      .then((j) => {
        foodImageMapCache = (j?.byKey ?? {}) as Record<string, string>;
        return foodImageMapCache;
      })
      .catch(() => {
        foodImageMapCache = {};
        return foodImageMapCache;
      });
  }
  return foodImageMapPromise;
}

function useFoodImageMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>(() => foodImageMapCache ?? {});
  useEffect(() => {
    let alive = true;
    void loadFoodImageMap().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
}

/** Tinta del thumb: macro dominante in kcal (CHO/PRO 4 kcal/g, FAT 9). */
function foodThumbToneClass(carbsG: number, proteinG: number, fatG: number): string {
  const cho = carbsG * 4;
  const pro = proteinG * 4;
  const fat = fatG * 9;
  if (cho >= pro && cho >= fat) return "empathy-meal-expo-food-thumb--cho";
  if (pro >= fat) return "empathy-meal-expo-food-thumb--pro";
  return "empathy-meal-expo-food-thumb--fat";
}

function slotHeaderIcon(slot: MealSlotKey | "pre_sleep"): LucideIcon {
  switch (slot) {
    case "breakfast":
      return Sunrise;
    case "lunch":
      return Sun;
    case "dinner":
      return Moon;
    case "snack_am":
      return Apple;
    case "snack_pm":
    case "snack_evening":
      return Coffee;
    case "pre_sleep":
      return Bed;
    default:
      return ShoppingBag;
  }
}

function giPillClass(band: GiBand): string {
  switch (band) {
    case "low":
      return "empathy-meal-expo-igpill--low";
    case "med":
      return "empathy-meal-expo-igpill--med";
    case "high":
      return "empathy-meal-expo-igpill--high";
    case "vhigh":
      return "empathy-meal-expo-igpill--vhigh";
    default:
      return "";
  }
}

export type EmpathyExpositionItem = {
  sourceIndex: number;
  name: string;
  portionHint?: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  ig: number;
  weightG?: number;
};

export function buildExpositionItemsFromPlan(
  items: IntelligentMealPlanItemOut[],
  visible: (idx: number) => boolean,
): EmpathyExpositionItem[] {
  return items
    .map((it, ii) => ({ it, ii }))
    .filter(({ ii }) => visible(ii))
    .map(({ it, ii }) => {
      const m = approxMacrosForPlanItem(it);
      const ig = estimatedItemGlycemicIndex(it);
      // Per i compose multi-ingrediente (es. Smoothie colazione = bev + frutta + frutti di bosco)
      // il badge "Xg" preso dal primo numero del portionHint e' fuorviante: rappresenta solo
      // uno degli ingredienti. In quel caso non mostriamo il peso (i nutrienti arrivano gia'
      // dallo scaling per kcal in `nutrientsForMealPlanItem`).
      const portionHintTrim = it.portionHint?.trim() ?? "";
      const isCompose = looksLikeMultiIngredientPortionHint(portionHintTrim);
      const weightG = isCompose ? undefined : parseGramsFromPortion(`${portionHintTrim} ${it.name}`.trim());
      return {
        sourceIndex: ii,
        name: it.name,
        portionHint: portionHintTrim || undefined,
        kcal: m.kcal,
        carbsG: m.carbsG,
        proteinG: m.proteinG,
        fatG: m.fatG,
        ig,
        weightG,
      };
    });
}

type EmpathyMealPlanExpositionCardProps = {
  slot: MealSlotKey | "pre_sleep";
  titleUpper: string;
  subline?: string;
  totalKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  items: EmpathyExpositionItem[];
  placeholder?: boolean;
  showCoachControls?: boolean;
  onCoachRemove?: (sourceIndex: number) => void;
  onCoachExcludeProfile?: (sourceIndex: number) => void;
  profileFoodExcludeBusyLabel?: string | null;
  athleteId?: string | null;
  /**
   * Suggerimento complementare dal sistema intelligente (cofactors/substrates pathway-modulation):
   * top-3 alimenti USDA per nutrient target. Non sostituisce gli alimenti scelti dal composer.
   */
  boostNote?: string;
  /** URL del modulo Integrazione (se passato, il banner boost mostra "Apri integrazione →"). */
  integrationHref?: string;
};

export function EmpathyMealPlanExpositionCard({
  slot,
  titleUpper,
  subline,
  totalKcal,
  carbsG,
  proteinG,
  fatG,
  items,
  placeholder,
  showCoachControls,
  onCoachRemove,
  onCoachExcludeProfile,
  profileFoodExcludeBusyLabel,
  athleteId,
  boostNote,
  integrationHref,
}: EmpathyMealPlanExpositionCardProps) {
  const t = useTranslations("EmpathyMealPlanExpositionCard");
  const { adminScoped, platformAdminView } = useActiveAthlete();
  const foodImageMap = useFoodImageMap();
  const Icon = slotHeaderIcon(slot);
  const kcalDenom = Math.max(1, totalKcal);
  const choPct = Math.round(((carbsG * 4) / kcalDenom) * 100);
  const proPct = Math.round(((proteinG * 4) / kcalDenom) * 100);
  const fatPct = Math.max(0, 100 - choPct - proPct);

  const igWeighted =
    items.length > 0
      ? weightedAvgGlycemicIndex(items.map((i) => ({ ig: i.ig, kcal: i.kcal })))
      : Math.round(38 + (choPct / 100) * 38);
  const slotBand = bandFromGi(igWeighted);
  const stimulus = stimulusLabelFromAvgGi(slotBand);

  if (placeholder) {
    return (
      <article className={cn("empathy-meal-expo-card empathy-meal-expo-card--placeholder", `empathy-meal-expo-card--slot-${slot}`)}>
        <header className="empathy-meal-expo-head">
          <div className="empathy-meal-expo-icon-wrap" aria-hidden>
            <Icon className="empathy-meal-expo-icon" strokeWidth={1.75} />
          </div>
          <div className="empathy-meal-expo-head-text">
            <h3 className="empathy-meal-expo-title">{titleUpper}</h3>
            {subline ? <p className="empathy-meal-expo-sub">{subline}</p> : null}
          </div>
        </header>
        <p className="empathy-meal-expo-placeholder-note">
          {t("placeholderNote")}
        </p>
      </article>
    );
  }

  return (
    <article className={cn("empathy-meal-expo-card", `empathy-meal-expo-card--slot-${slot}`)}>
      <header className="empathy-meal-expo-banner">
        <div className="empathy-meal-expo-icon-wrap empathy-meal-expo-icon-wrap--banner" aria-hidden>
          <Icon className="empathy-meal-expo-icon" strokeWidth={1.75} />
        </div>
        <div className="empathy-meal-expo-banner-center">
          <h3 className="empathy-meal-expo-title-banner">{titleUpper}</h3>
          {subline ? <p className="empathy-meal-expo-sub-banner">{subline}</p> : null}
        </div>
        <div className="empathy-meal-expo-kcal-tile" aria-label={t("kcalAria", { totalKcal })}>
          <span className="empathy-meal-expo-kcal-num">{Math.round(totalKcal)}</span>
          <span className="empathy-meal-expo-kcal-unit">KCAL</span>
        </div>
      </header>

      <div className="empathy-meal-expo-general">
      <div className="empathy-meal-expo-macros">
        <div className="empathy-meal-expo-macro empathy-meal-expo-macro--cho">
          <Activity className="empathy-meal-expo-macro-ic" strokeWidth={1.6} aria-hidden />
          <span className="empathy-meal-expo-macro-label">{t("macroCarbs")}</span>
          <span className="empathy-meal-expo-macro-val">{Math.round(carbsG)} g</span>
        </div>
        <div className="empathy-meal-expo-macro empathy-meal-expo-macro--pro">
          <Zap className="empathy-meal-expo-macro-ic" strokeWidth={1.6} aria-hidden />
          <span className="empathy-meal-expo-macro-label">{t("macroProtein")}</span>
          <span className="empathy-meal-expo-macro-val">{Math.round(proteinG)} g</span>
        </div>
        <div className="empathy-meal-expo-macro empathy-meal-expo-macro--fat">
          <Droplets className="empathy-meal-expo-macro-ic" strokeWidth={1.6} aria-hidden />
          <span className="empathy-meal-expo-macro-label">{t("macroFats")}</span>
          <span className="empathy-meal-expo-macro-val">{Math.round(fatG)} g</span>
        </div>
        {/* IG medio come quarta colonna accanto alle macro: la riga dedicata
            occupava ~60px verticali in ogni card (feedback utente 2026-07). */}
        <div className="empathy-meal-expo-macro empathy-meal-expo-macro--ig">
          <TrendingUp className="empathy-meal-expo-macro-ic" strokeWidth={1.6} aria-hidden />
          <span className="empathy-meal-expo-macro-label">{t("avgGiShort")}</span>
          <span className="empathy-meal-expo-macro-val">{igWeighted}</span>
          <span className={cn("empathy-meal-expo-macro-igband", giPillClass(slotBand))}>
            {giBandLabelIt(slotBand)}
          </span>
          <span
            className={cn(
              "empathy-meal-expo-macro-stim",
              stimulus.tone === "alto" && "empathy-meal-expo-macro-stim--high",
              stimulus.tone === "medio" && "empathy-meal-expo-macro-stim--med",
              stimulus.tone === "basso" && "empathy-meal-expo-macro-stim--low",
            )}
          >
            {stimulus.text}
          </span>
        </div>
      </div>

      <div className="empathy-meal-expo-macro-bar">
        <span className="empathy-meal-expo-macro-seg empathy-meal-expo-macro-seg--cho">CHO {choPct}%</span>
        <span className="empathy-meal-expo-macro-seg empathy-meal-expo-macro-seg--pro">PRO {proPct}%</span>
        <span className="empathy-meal-expo-macro-seg empathy-meal-expo-macro-seg--fat">FAT {fatPct}%</span>
      </div>
      </div>

      {boostNote ? (
        <aside
          className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2"
          aria-label={t("boostAsideAria")}
        >
          <div className="flex items-start gap-2">
            <Zap
              className="mt-[2px] h-3.5 w-3.5 shrink-0 text-amber-300"
              strokeWidth={2}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
                {t("boostTitle")}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-amber-50/90">{boostNote}</p>
              <p className="mt-1 text-[10px] leading-snug text-amber-200/70">
                {t("boostBody")}
                {integrationHref ? (
                  <>
                    {" "}
                    {adminScoped ? (
                      /* Nelle schede admin il link cross-shell è inerte (v2). */
                      <span
                        className="font-semibold text-amber-200 underline decoration-amber-300/60 underline-offset-2 hover:text-amber-100 cursor-default opacity-50"
                        title={t("openIntegrationDisabledTitle")}
                      >
                        {t("openIntegration")}
                      </span>
                    ) : (
                      <Link
                        href={integrationHref}
                        className="font-semibold text-amber-200 underline decoration-amber-300/60 underline-offset-2 hover:text-amber-100"
                      >
                        {t("openIntegration")}
                      </Link>
                    )}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </aside>
      ) : null}

      <div className="empathy-meal-expo-detail">
      <section className="empathy-meal-expo-detail-head">
        <span className="empathy-meal-expo-detail-bar" aria-hidden />
        <h4 className="empathy-meal-expo-detail-title">{t("detailedFoodsTitle")}</h4>
      </section>

      <ul className="empathy-meal-expo-food-list">
        {items.length === 0 ? (
          <li className="empathy-meal-expo-food-empty muted-copy">{t("noItems")}</li>
        ) : (
          items.map((food) => {
            const b = bandFromGi(food.ig);
            const busy = profileFoodExcludeBusyLabel === food.name.trim();
            const FoodIcon = foodItemIcon(food.name);
            // Foto reale se il cibo (per chiave canonica) ne ha una; altrimenti icona.
            const foodImageUrl = foodImageMap[inferCanonicalFoodKeyPreferName(food.name, food.portionHint ?? "")];
            return (
              <li key={`${food.name}-${food.sourceIndex}`} className="empathy-meal-expo-food-card">
                {/* Thumb grande a tutta altezza: foto reale del cibo se presente,
                    altrimenti icona deterministica dal nome + tinta macro dominante. */}
                <div
                  className={cn(
                    "empathy-meal-expo-food-thumb",
                    foodThumbToneClass(food.carbsG, food.proteinG, food.fatG),
                  )}
                  aria-hidden
                >
                  {foodImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foodImageUrl}
                      alt=""
                      loading="lazy"
                      className="empathy-meal-expo-food-thumb-img"
                    />
                  ) : (
                    <FoodIcon className="empathy-meal-expo-food-thumb-icon" strokeWidth={1.4} />
                  )}
                </div>
                <div className="empathy-meal-expo-food-body">
                  <div className="empathy-meal-expo-food-name-row">
                    <span className="empathy-meal-expo-dot" aria-hidden />
                    <span className="empathy-meal-expo-food-name">{food.name}</span>
                  </div>
                  <div className="empathy-meal-expo-food-pills">
                    {food.weightG != null ? (
                      <span className="empathy-meal-expo-pill empathy-meal-expo-pill--wt">{food.weightG}g</span>
                    ) : null}
                    <span className="empathy-meal-expo-pill empathy-meal-expo-pill--kcal">
                      <Flame className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      {food.kcal}
                    </span>
                    <span className={cn("empathy-meal-expo-pill", "empathy-meal-expo-pill--ig", giPillClass(b))}>
                      IG {food.ig} · {giBandLabelIt(b)}
                    </span>
                  </div>
                  <div className="empathy-meal-expo-food-macros">
                    <div className="empathy-meal-expo-pod empathy-meal-expo-pod--cho">
                      <span className="empathy-meal-expo-pod-dot" />
                      <span className="empathy-meal-expo-pod-lab">CHO</span>
                      <span className="empathy-meal-expo-pod-val">{food.carbsG}g</span>
                    </div>
                    <div className="empathy-meal-expo-pod empathy-meal-expo-pod--pro">
                      <span className="empathy-meal-expo-pod-dot" />
                      <span className="empathy-meal-expo-pod-lab">PRO</span>
                      <span className="empathy-meal-expo-pod-val">{food.proteinG}g</span>
                    </div>
                    <div className="empathy-meal-expo-pod empathy-meal-expo-pod--fat">
                      <span className="empathy-meal-expo-pod-dot" />
                      <span className="empathy-meal-expo-pod-lab">FAT</span>
                      <span className="empathy-meal-expo-pod-val">{food.fatG}g</span>
                    </div>
                  </div>
                {showCoachControls && platformAdminView && onCoachRemove && onCoachExcludeProfile ? (
                  <div className="empathy-meal-expo-coach">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
                      onClick={() => onCoachRemove(food.sourceIndex)}
                    >
                      {t("coachRemove")}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!athleteId || busy}
                      onClick={() => onCoachExcludeProfile(food.sourceIndex)}
                    >
                      {busy ? t("coachSaving") : t("coachExcludeProfile")}
                    </button>
                  </div>
                ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
      </div>
    </article>
  );
}

export function EmpathyMealPlanGlycemicLegend() {
  const t = useTranslations("EmpathyMealPlanExpositionCard");
  return (
    <section className="empathy-meal-expo-legend" aria-label={t("legendAria")}>
      <div className="empathy-meal-expo-detail-head empathy-meal-expo-detail-head--legend">
        <TrendingUp className="h-4 w-4 text-[var(--nutri-expo-pink)]" strokeWidth={2} aria-hidden />
        <h4 className="empathy-meal-expo-detail-title">{t("legendTitle")}</h4>
      </div>
      <div className="empathy-meal-expo-legend-grid">
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--low">
          <strong>{t("legendLow")}</strong>
          <span>&lt; 35</span>
        </div>
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--med">
          <strong>{t("legendMedium")}</strong>
          <span>35–55</span>
        </div>
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--high">
          <strong>{t("legendHigh")}</strong>
          <span>55–70</span>
        </div>
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--vhigh">
          <strong>{t("legendVeryHigh")}</strong>
          <span>&gt; 70</span>
        </div>
      </div>
      <p className="empathy-meal-expo-legend-note muted-copy text-[11px] leading-snug">
        {t("legendNote")}
      </p>
    </section>
  );
}
