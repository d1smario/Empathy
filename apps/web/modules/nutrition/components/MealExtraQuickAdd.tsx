"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { postFoodDiaryEntry } from "@/modules/nutrition/services/food-diary-api";
import type { FoodLookupItem } from "@/lib/nutrition/nutrition-view-types";

/**
 * «Ho mangiato questo in più» — quick-add di un extra DENTRO la card pasto del
 * Piano (2026-07: la logica di registrazione del Diario scende al livello del
 * singolo pasto). Scrive una voce di diario sullo slot del pasto: gli aggregati
 * del Diario (assunto/mancante) la vedono automaticamente.
 */
export function MealExtraQuickAdd({
  athleteId,
  entryDate,
  mealSlot,
  onSaved,
}: {
  athleteId: string;
  entryDate: string;
  mealSlot: string;
  onSaved?: () => void;
}) {
  const t = useTranslations("MealExtraQuickAdd");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodLookupItem[]>([]);
  const [selected, setSelected] = useState<FoodLookupItem | null>(null);
  const [grams, setGrams] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/nutrition/food-lookup?q=${encodeURIComponent(q)}`, { method: "GET" });
      const payload = (await res.json()) as { items?: FoodLookupItem[]; error?: string };
      if (!res.ok) throw new Error(payload.error || t("searchError"));
      setResults(Array.isArray(payload.items) ? payload.items.slice(0, 6) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("searchError"));
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected || !athleteId) return;
    const qg = Math.max(1, Math.round(grams));
    // Il diario accetta solo breakfast|lunch|dinner|snack|other: gli slot del
    // piano snack_am/snack_pm/snack_evening collassano su "snack".
    const diarySlot = mealSlot.startsWith("snack")
      ? "snack"
      : ["breakfast", "lunch", "dinner"].includes(mealSlot)
        ? mealSlot
        : "other";
    setBusy(true);
    setError(null);
    let result: { error?: string | null };
    if (selected.source === "brand-site" && selected.catalogId?.trim()) {
      result = await postFoodDiaryEntry({
        athleteId,
        entryDate,
        mealSlot: diarySlot,
        mode: "catalog_product",
        catalogId: selected.catalogId.trim(),
        quantityG: qg,
      });
    } else if (selected.source === "usda" && selected.fdcId != null && Number.isFinite(selected.fdcId)) {
      result = await postFoodDiaryEntry({
        athleteId,
        entryDate,
        mealSlot: diarySlot,
        mode: "usda_fdc",
        fdcId: selected.fdcId,
        quantityG: qg,
      });
    } else if (
      selected.kcal_100 != null &&
      selected.carbs_100 != null &&
      selected.protein_100 != null &&
      selected.fat_100 != null
    ) {
      result = await postFoodDiaryEntry({
        athleteId,
        entryDate,
        mealSlot: diarySlot,
        mode: "scaled_reference",
        foodLabel: [selected.brand, selected.label].filter(Boolean).join(" · ") || selected.label,
        quantityG: qg,
        kcalPer100g: selected.kcal_100,
        carbsPer100g: selected.carbs_100,
        proteinPer100g: selected.protein_100,
        fatPer100g: selected.fat_100,
        sodiumMgPer100g: selected.sodium_mg_100,
        referenceSourceTag: "meal_extra_quick_add",
      });
    } else {
      setError(t("incompleteData"));
      setBusy(false);
      return;
    }
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSelected(null);
    setQuery("");
    setResults([]);
    setGrams(100);
    // Chiudi il pannello: il flash «Aggiunto ✓» vive sul bottone collassato.
    setOpen(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    onSaved?.();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[0.7rem] font-semibold text-gray-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/10"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {savedFlash ? t("savedFlash") : t("addExtra")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.7rem] font-bold uppercase tracking-wider text-gray-400">{t("panelTitle")}</p>
        <button type="button" className="text-[0.7rem] text-gray-500 hover:text-gray-300" onClick={() => setOpen(false)}>
          {t("close")}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
          placeholder={t("searchPlaceholder")}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600"
        />
        <button
          type="button"
          disabled={busy || query.trim().length < 2}
          onClick={() => void runSearch()}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 disabled:opacity-50"
        >
          {t("search")}
        </button>
      </div>
      {results.length && !selected ? (
        <p className="mt-2 text-[0.68rem] text-amber-200/80">{t("pickHint")}</p>
      ) : null}
      {results.length ? (
        <ul className="mt-2 space-y-1">
          {results.map((r, i) => (
            <li key={`${r.source}-${r.fdcId ?? r.catalogId ?? i}`}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                  selected === r ? "bg-amber-500/20 text-amber-100" : "text-gray-300 hover:bg-white/10"
                }`}
              >
                <span className="font-medium">{[r.brand, r.label].filter(Boolean).join(" · ")}</span>
                {r.kcal_100 != null ? <span className="text-gray-500"> · {Math.round(r.kcal_100)} kcal/100g</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected ? (
        <div className="mt-2 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[0.7rem] text-gray-400">
            {t("quantity")}
            <input
              type="number"
              min={1}
              value={grams}
              onChange={(e) => setGrams(Number(e.target.value) || 0)}
              className="w-20 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
            />
            g
          </label>
          <button
            type="button"
            disabled={busy || grams <= 0}
            onClick={() => void save()}
            className="btn-nutrition-cta px-4 py-1.5 text-xs"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-[0.7rem] text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
