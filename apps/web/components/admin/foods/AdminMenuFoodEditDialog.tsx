"use client";

import { useEffect, useState, useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MENU_FOOD_SERVING_BASES } from "@/lib/nutrition/v2/menu-food-pools";
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
  title: "Modifica cibo del menù",
  close: "Chiudi",
  cancel: "Annulla",
  save: "Salva modifiche",
  saving: "Salvataggio…",
  secIdentity: "Identità",
  secPools: "Pool del menù",
  secFlags: "Classificazione",
  labelIt: "Nome (italiano)",
  servingBasis: "Base di pesatura",
  poolsHint: "Almeno un pool: sono gli slot in cui il motore può usare questo cibo.",
  rotationKey: "Chiave di rotazione",
  rotationKeyPh: "es. riso (facoltativo)",
  carbFamily: "Famiglia carboidrati",
  carbFamilyPh: "es. cereali (facoltativo)",
  sortPriority: "Priorità (più bassa = preferito)",
  isMeat: "Carne 🥩",
  isFish: "Pesce 🐟",
  isAnimalProduct: "Prodotto animale 🥛",
  errLabelRequired: "Il nome è obbligatorio.",
  errPoolsRequired: "Seleziona almeno un pool.",
  errSavePrefix: "Salvataggio non riuscito",
  errMealRolesPrefix: "Ruoli e punteggi",
} as const;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-amber-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-400";

type Draft = {
  label_it: string;
  serving_basis: string;
  pool_keys: string[];
  rotation_key: string;
  carb_family: string;
  is_meat: boolean;
  is_fish: boolean;
  is_animal_product: boolean;
  sort_priority: string;
  meal_roles: MealRolesDraft;
};

/**
 * Precompila la grammatica dalla riga di score se c'è; altrimenti dai pool (default puri)
 * e il form mostra l'avviso «fuori grammatica».
 */
function draftFromRow(row: AdminMenuFoodRow): Draft {
  return {
    label_it: row.label_it,
    serving_basis: row.serving_basis,
    pool_keys: [...row.pool_keys],
    rotation_key: row.rotation_key ?? "",
    carb_family: row.carb_family ?? "",
    is_meat: row.is_meat,
    is_fish: row.is_fish,
    is_animal_product: row.is_animal_product,
    sort_priority: String(row.sort_priority),
    meal_roles: mealRolesDraftFromInput(row.meal_roles ?? defaultMealRolesFromPools(row.pool_keys)),
  };
}

/**
 * Dialog di modifica di una riga del Catalogo menù (`nutrition_menu_foods`). Il
 * `fdc_id` NON è modificabile (cambierebbe l'identità del cibo). PATCH via
 * /api/admin/menu-foods/[canonical_key].
 */
export function AdminMenuFoodEditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: AdminMenuFoodRow;
  onClose: () => void;
  onSaved: (saved: AdminMenuFoodRow) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromRow(row));
  /** Fotografia della grammatica all'apertura: serve a sapere se l'admin l'ha toccata. */
  const initialMealRolesBody = useMemo(() => mealRolesDraftToBody(draftFromRow(row).meal_roles), [row]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const togglePool = (key: string) =>
    setDraft((d) => ({
      ...d,
      pool_keys: d.pool_keys.includes(key) ? d.pool_keys.filter((k) => k !== key) : [...d.pool_keys, key],
    }));

  const save = async () => {
    const found: string[] = [];
    if (!draft.label_it.trim()) found.push(COPY.errLabelRequired);
    if (draft.pool_keys.length === 0) found.push(COPY.errPoolsRequired);
    // Stessa validazione della API, qui per un messaggio immediato e leggibile: ciò che
    // passa di qui è esattamente ciò che il loader del motore accetta.
    const mealRolesBody = mealRolesDraftToBody(draft.meal_roles);
    const mealRolesCheck = validateMenuFoodMealRoles(mealRolesBody);
    if (!mealRolesCheck.ok) found.push(`${COPY.errMealRolesPrefix}: ${mealRolesCheck.error}`);
    if (found.length > 0) {
      setErrors(found);
      return;
    }

    const spRaw = draft.sort_priority.trim();
    const patch: Record<string, unknown> = {
      label_it: draft.label_it.trim(),
      serving_basis: draft.serving_basis,
      pool_keys: draft.pool_keys,
      rotation_key: draft.rotation_key.trim() || null,
      carb_family: draft.carb_family.trim() || null,
      is_meat: draft.is_meat,
      is_fish: draft.is_fish,
      is_animal_product: draft.is_animal_product,
    };
    // La grammatica si invia SOLO se l'admin l'ha toccata, o se l'alimento ne era privo
    // (così un «fuori grammatica» entra al primo salvataggio). Altrimenti un salvataggio
    // qualsiasi — cambiare la priorità, un flag — riscriverebbe la riga score identica ma
    // con source_version 'admin', e si perderebbe la traccia di cosa è ancora intatto da
    // Mario (mario_v5): è l'unico modo per sapere, fra sei mesi, quali score sono suoi.
    const mealRolesTouched = JSON.stringify(mealRolesBody) !== JSON.stringify(initialMealRolesBody);
    if (mealRolesTouched || !row.has_meal_roles) patch.meal_roles = mealRolesBody;
    if (spRaw !== "") {
      const sp = Number(spRaw);
      if (Number.isFinite(sp)) patch.sort_priority = Math.trunc(sp);
    }

    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch(`/api/admin/menu-foods/${encodeURIComponent(row.canonical_key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = (await res.json()) as { ok?: boolean; food?: AdminMenuFoodRow; error?: string };
      if (!res.ok || !j.ok || !j.food) {
        setErrors([j.error ? `${COPY.errSavePrefix}: ${j.error}` : `${COPY.errSavePrefix}.`]);
        return;
      }
      onSaved(j.food);
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
            <p className="truncate font-mono text-[11px] text-zinc-500">
              {row.canonical_key} · #{row.fdc_id}
              {row.usdaDescription ? ` · ${row.usdaDescription}` : ""}
            </p>
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

          {/* Identità */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secIdentity}</p>
            <div>
              <label className={LABEL} htmlFor="menu-food-label">
                {COPY.labelIt}
              </label>
              <input
                id="menu-food-label"
                type="text"
                value={draft.label_it}
                onChange={(e) => set("label_it", e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="menu-food-basis">
                  {COPY.servingBasis}
                </label>
                <select
                  id="menu-food-basis"
                  value={draft.serving_basis}
                  onChange={(e) => set("serving_basis", e.target.value)}
                  className={INPUT}
                >
                  {MENU_FOOD_SERVING_BASES.map((b) => (
                    <option key={b} value={b}>
                      {SERVING_BASIS_LABELS[b] ?? b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="menu-food-priority">
                  {COPY.sortPriority}
                </label>
                <input
                  id="menu-food-priority"
                  type="number"
                  step="1"
                  value={draft.sort_priority}
                  onChange={(e) => set("sort_priority", e.target.value)}
                  className={cn(INPUT, "text-right font-mono tabular-nums")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="menu-food-rotation">
                  {COPY.rotationKey}
                </label>
                <input
                  id="menu-food-rotation"
                  type="text"
                  value={draft.rotation_key}
                  onChange={(e) => set("rotation_key", e.target.value)}
                  placeholder={COPY.rotationKeyPh}
                  className={cn(INPUT, "font-mono text-xs")}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="menu-food-carbfamily">
                  {COPY.carbFamily}
                </label>
                <input
                  id="menu-food-carbfamily"
                  type="text"
                  value={draft.carb_family}
                  onChange={(e) => set("carb_family", e.target.value)}
                  placeholder={COPY.carbFamilyPh}
                  className={cn(INPUT, "font-mono text-xs")}
                />
              </div>
            </div>
          </section>

          {/* Pool */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secPools}</p>
            <p className="text-[0.65rem] text-gray-600">{COPY.poolsHint}</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {MENU_FOOD_POOL_ORDER.map((key) => {
                const checked = draft.pool_keys.includes(key);
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

          {/* Grammatica: ruoli e punteggi per pasto */}
          <AdminMenuFoodMealRolesFields
            idPrefix="menu-food-roles"
            draft={draft.meal_roles}
            onChange={(next) => set("meal_roles", next)}
            showDefaultsWarning={!row.has_meal_roles}
            sourceVersion={row.meal_roles?.source_version ?? null}
            updatedAt={row.meal_roles?.updated_at ?? null}
          />

          {/* Flag dieta */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secFlags}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["is_meat", COPY.isMeat],
                  ["is_fish", COPY.isFish],
                  ["is_animal_product", COPY.isAnimalProduct],
                ] as const
              ).map(([field, label]) => {
                const checked = draft[field];
                return (
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
                      onChange={(e) => set(field, e.target.checked)}
                      className="h-3.5 w-3.5 accent-rose-400"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </section>
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
            disabled={saving}
            className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500/25 disabled:opacity-50"
          >
            {saving ? COPY.saving : COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
}
