"use client";

import { useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MENU_FOOD_SERVING_BASES } from "@/lib/nutrition/v2/menu-food-pools";
import type { FoodRow } from "@/components/admin/foods/food-types";
import { fmtNum } from "@/components/admin/foods/food-types";
import type { AdminMenuFoodRow } from "@/components/admin/foods/menu-food-types";
import {
  MENU_FOOD_POOL_ORDER,
  poolLabel,
  SERVING_BASIS_LABELS,
} from "@/components/admin/foods/menu-food-pool-labels";
import {
  defaultMealRolesFromPools,
  validateMenuFoodMealRoles,
} from "@/lib/admin/menu-food-meal-roles-validation";
import {
  AdminMenuFoodMealRolesFields,
  mealRolesDraftFromInput,
  mealRolesDraftToBody,
  type MealRolesDraft,
} from "@/components/admin/foods/AdminMenuFoodMealRolesFields";

const COPY = {
  title: "Aggiungi alimento dal database",
  subtitle: "Cerca nel database USDA (8.000 alimenti) e promuovi la riga nel catalogo menù.",
  close: "Chiudi",
  cancel: "Annulla",
  save: "Aggiungi al menù",
  saving: "Aggiunta…",
  searchPh: "Cerca per descrizione USDA…",
  searchHint: "Digita almeno 2 caratteri.",
  searching: "Ricerca…",
  noResults: "Nessun alimento trovato.",
  pick: "Seleziona",
  picked: "Selezionato",
  secForm: "Dati del cibo nel menù",
  canonicalKey: "Chiave canonica (snake_case)",
  labelIt: "Nome (italiano)",
  servingBasis: "Base di pesatura",
  secPools: "Pool del menù",
  poolsHint: "Almeno un pool: sono gli slot in cui il motore può usare questo cibo.",
  secFlags: "Classificazione",
  isMeat: "Carne 🥩",
  isFish: "Pesce 🐟",
  isAnimalProduct: "Prodotto animale 🥛",
  errNoFood: "Seleziona prima un alimento dal database.",
  errCanonical: "La chiave canonica deve essere snake_case (minuscole, cifre, underscore).",
  errLabel: "Il nome è obbligatorio.",
  errPools: "Seleziona almeno un pool.",
  errSavePrefix: "Aggiunta non riuscita",
  errMealRolesPrefix: "Ruoli e punteggi",
  mealRolesAuto: "Proposti dai pool scelti: si aggiornano finché non li modifichi a mano.",
} as const;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-amber-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-400";

const SNAKE_CASE_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** Slug snake_case da una descrizione USDA (per precompilare canonical_key). */
function toSnakeCase(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function AdminMenuFoodAddDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (added: AdminMenuFoodRow, warning?: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [results, setResults] = useState<FoodRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [picked, setPicked] = useState<FoodRow | null>(null);
  const [canonicalKey, setCanonicalKey] = useState("");
  const [labelIt, setLabelIt] = useState("");
  const [servingBasis, setServingBasis] = useState<string>(MENU_FOOD_SERVING_BASES[0]);
  const [poolKeys, setPoolKeys] = useState<string[]>([]);
  const [isMeat, setIsMeat] = useState(false);
  const [isFish, setIsFish] = useState(false);
  const [isAnimalProduct, setIsAnimalProduct] = useState(false);
  // Grammatica: finché l'admin non la tocca, segue i pool (default puri); al primo
  // ritocco manuale smette di seguirli (non si sovrascrive il lavoro fatto a mano).
  const [mealRoles, setMealRoles] = useState<MealRolesDraft>(() =>
    mealRolesDraftFromInput(defaultMealRolesFromPools([])),
  );
  const [mealRolesTouched, setMealRolesTouched] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounce ricerca.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (debouncedQ.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const sp = new URLSearchParams({ q: debouncedQ, limit: "20", offset: "0" });
        const res = await fetch(`/api/admin/foods?${sp.toString()}`, { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; foods?: FoodRow[] };
        if (cancelled) return;
        setResults(res.ok && j.ok ? j.foods ?? [] : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) {
          setSearching(false);
          setSearched(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const pick = (food: FoodRow) => {
    setPicked(food);
    setCanonicalKey(toSnakeCase(food.description).slice(0, 60));
    setLabelIt(food.description);
    setErrors([]);
  };

  const togglePool = (key: string) =>
    setPoolKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (!mealRolesTouched) setMealRoles(mealRolesDraftFromInput(defaultMealRolesFromPools(next)));
      return next;
    });

  const save = async () => {
    const found: string[] = [];
    if (!picked) found.push(COPY.errNoFood);
    if (!SNAKE_CASE_RE.test(canonicalKey.trim())) found.push(COPY.errCanonical);
    if (!labelIt.trim()) found.push(COPY.errLabel);
    if (poolKeys.length === 0) found.push(COPY.errPools);
    const mealRolesBody = mealRolesDraftToBody(mealRoles);
    const mealRolesCheck = validateMenuFoodMealRoles(mealRolesBody);
    if (!mealRolesCheck.ok) found.push(`${COPY.errMealRolesPrefix}: ${mealRolesCheck.error}`);
    if (found.length > 0) {
      setErrors(found);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch("/api/admin/menu-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonical_key: canonicalKey.trim(),
          fdc_id: picked!.fdc_id,
          label_it: labelIt.trim(),
          serving_basis: servingBasis,
          pool_keys: poolKeys,
          is_meat: isMeat,
          is_fish: isFish,
          is_animal_product: isAnimalProduct,
          meal_roles: mealRolesBody,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; food?: AdminMenuFoodRow; error?: string; warning?: string | null };
      if (!res.ok || !j.ok || !j.food) {
        setErrors([j.error ? `${COPY.errSavePrefix}: ${j.error}` : `${COPY.errSavePrefix}.`]);
        return;
      }
      // L'alimento c'è anche se la riga di score non è passata: lo diciamo a chi chiama.
      onAdded(j.food, j.warning ?? null);
    } catch {
      setErrors([`${COPY.errSavePrefix}: richiesta non riuscita.`]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.title}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-white">{COPY.title}</h2>
            <p className="truncate text-[11px] text-zinc-500">{COPY.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={COPY.close}
            aria-label={COPY.close}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {errors.length > 0 ? (
            <ul className="space-y-1 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3" role="alert">
              {errors.map((e) => (
                <li key={e} className="text-sm text-red-300">
                  {e}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Ricerca DB */}
          <section className="space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={COPY.searchPh}
                aria-label={COPY.searchPh}
                className={cn(INPUT, "pl-8")}
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10">
              {searching ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500">{COPY.searching}</p>
              ) : q.trim().length < 2 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-600">{COPY.searchHint}</p>
              ) : searched && results.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500">{COPY.noResults}</p>
              ) : (
                <ul>
                  {results.map((f) => {
                    const isPicked = picked?.fdc_id === f.fdc_id;
                    return (
                      <li key={f.fdc_id}>
                        <button
                          type="button"
                          onClick={() => pick(f)}
                          className={cn(
                            "flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left transition last:border-b-0 hover:bg-white/[0.04]",
                            isPicked && "bg-amber-500/10",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[0.6rem]",
                              isPicked
                                ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
                                : "border-white/10 bg-white/5 text-gray-600",
                            )}
                            aria-hidden
                          >
                            {isPicked ? <Check className="h-3 w-3" /> : "+"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white">{f.description}</span>
                            <span className="block font-mono text-[11px] text-zinc-500">
                              #{f.fdc_id}
                              {f.food_category ? ` · ${f.food_category}` : ""} · {fmtNum(f.kcal_100g)} kcal
                            </span>
                          </span>
                          <span className="shrink-0 text-[0.65rem] font-medium text-gray-500">
                            {isPicked ? COPY.picked : COPY.pick}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Form di promozione (solo dopo la scelta) */}
          {picked ? (
            <>
              <section className="space-y-3">
                <p className={SECTION}>{COPY.secForm}</p>
                <div>
                  <label className={LABEL} htmlFor="menu-add-canonical">
                    {COPY.canonicalKey}
                  </label>
                  <input
                    id="menu-add-canonical"
                    type="text"
                    value={canonicalKey}
                    onChange={(e) => setCanonicalKey(e.target.value)}
                    className={cn(INPUT, "font-mono text-xs")}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="menu-add-label">
                    {COPY.labelIt}
                  </label>
                  <input
                    id="menu-add-label"
                    type="text"
                    value={labelIt}
                    onChange={(e) => setLabelIt(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="menu-add-basis">
                    {COPY.servingBasis}
                  </label>
                  <select
                    id="menu-add-basis"
                    value={servingBasis}
                    onChange={(e) => setServingBasis(e.target.value)}
                    className={INPUT}
                  >
                    {MENU_FOOD_SERVING_BASES.map((b) => (
                      <option key={b} value={b}>
                        {SERVING_BASIS_LABELS[b] ?? b}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="space-y-3">
                <p className={SECTION}>{COPY.secPools}</p>
                <p className="text-[0.65rem] text-gray-600">{COPY.poolsHint}</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {MENU_FOOD_POOL_ORDER.map((key) => {
                    const checked = poolKeys.includes(key);
                    return (
                      <label
                        key={key}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition",
                          checked
                            ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
                            : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePool(key)}
                          className="h-3.5 w-3.5 accent-amber-400"
                        />
                        {poolLabel(key)}
                      </label>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-2">
                <AdminMenuFoodMealRolesFields
                  idPrefix="menu-add-roles"
                  draft={mealRoles}
                  onChange={(next) => {
                    setMealRolesTouched(true);
                    setMealRoles(next);
                  }}
                  showDefaultsWarning={false}
                />
                {!mealRolesTouched ? <p className="text-[0.65rem] text-gray-600">{COPY.mealRolesAuto}</p> : null}
              </div>

              <section className="space-y-3">
                <p className={SECTION}>{COPY.secFlags}</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["is_meat", isMeat, setIsMeat, COPY.isMeat],
                      ["is_fish", isFish, setIsFish, COPY.isFish],
                      ["is_animal_product", isAnimalProduct, setIsAnimalProduct, COPY.isAnimalProduct],
                    ] as const
                  ).map(([field, checked, setter, label]) => (
                    <label
                      key={field}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition",
                        checked
                          ? "border-rose-400/50 bg-rose-500/10 text-rose-100"
                          : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setter(e.target.checked)}
                        className="h-3.5 w-3.5 accent-rose-400"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            {COPY.cancel}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !picked}
            className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500/25 disabled:opacity-50"
          >
            {saving ? COPY.saving : COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
}
