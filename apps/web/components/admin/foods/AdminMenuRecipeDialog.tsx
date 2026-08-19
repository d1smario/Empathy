"use client";

import { useEffect, useMemo, useState } from "react";
import { Droplets, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  computeRecipeMacrosPer100g,
  inheritRecipeDietFlags,
  RECIPE_FREQUENCIES,
  recipeGramsSumMessage,
  recipeKeyFromLabel,
  sumRecipeGrams,
  validateRecipeInput,
  type RecipeCatalogFood,
  type RecipeFrequency,
} from "@/lib/admin/menu-recipe-validation";
import { fmtNum } from "@/components/admin/foods/food-types";
import type { AdminMenuFoodRow } from "@/components/admin/foods/menu-food-types";
import { RECIPE_FREQUENCY_LABELS, type AdminMenuRecipeRow } from "@/components/admin/foods/menu-recipe-types";

const COPY = {
  titleAdd: "Aggiungi ricetta",
  titleEdit: "Modifica ricetta",
  subtitle:
    "Una ricetta è una regola di combinazione su alimenti del catalogo menù: niente macro proprie, si calcolano dagli ingredienti (per 100 g di piatto).",
  close: "Chiudi",
  cancel: "Annulla",
  saveAdd: "Crea ricetta",
  saveEdit: "Salva modifiche",
  saving: "Salvataggio…",
  secIdentity: "Identità",
  labelIt: "Nome (italiano)",
  labelPh: "es. Pasta alla carbonara",
  recipeKey: "Chiave (recipe_key, snake_case)",
  recipeKeyLocked: "La chiave non si cambia: i piani già serviti la citano.",
  note: "Nota (facoltativa)",
  notePh: "es. versione leggera, senza panna",
  isActive: "Attiva (visibile al motore)",
  secIngredients: "Ingredienti (grammi per 100 g di piatto)",
  ingredientsHint:
    "Cerca SOLO nel catalogo menù (gli alimenti che il motore conosce). Per ogni ingrediente indica quanti grammi entrano in 100 g di piatto cotto.",
  searchPh: "Cerca un alimento del catalogo…",
  searchHint: "Digita almeno 2 caratteri.",
  noResults: "Nessun alimento attivo nel catalogo con questo nome.",
  catalogLoading: "Caricamento catalogo menù…",
  catalogError: "Impossibile caricare il catalogo menù: riprova.",
  addNeutral: "+ componente neutro (acqua/brodo)",
  neutralLabel: "Acqua / brodo neutro",
  neutralHint: "zero nutrienti, sposta solo il peso",
  removeRow: "Rimuovi",
  gramsPh: "g",
  thIngredient: "Ingrediente",
  thGrams: "g / 100 g",
  thKcal: "kcal",
  emptyRows: "Nessun ingrediente: cercane uno qui sopra.",
  sumLabel: "Somma",
  sumOk: "Somma in tolleranza (99–101 g).",
  secMacro: "Valori nutrizionali calcolati",
  per100: "per 100 g di ricetta",
  portion: (g: number) => `porzione tipo ${g} g`,
  macroMissing: (keys: string[]) => `Senza macro a DB (contati a zero): ${keys.join(", ")}.`,
  secFrequency: "Frequenza",
  frequency: "Frequenza",
  maxWeek: "Max a settimana (1-7, vuoto = nessun tetto)",
  frequencyHint: "Come per gli alimenti: quanto spesso la ricetta può comparire. Il motore non le legge ancora.",
  frequencyNoColumns:
    "Colonne frequency/max_week non ancora migrate a DB: i campi si vedono ma NON vengono salvati finché la migration non è applicata.",
  secDiet: "Dieta (ereditata dagli ingredienti, sola lettura)",
  dietVeg: "vegetale",
  dietMeat: "contiene carne 🥩",
  dietFish: "contiene pesce 🐟",
  dietAnimal: "origine animale 🥛",
  errSavePrefix: "Salvataggio non riuscito",
  kcalLabel: "Kcal",
  choLabel: "Carb",
  proLabel: "Prot",
  fatLabel: "Grassi",
} as const;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-amber-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-400";

/** Porzione «tipo» di riferimento per capire se la ricetta ha senso (300 g di piatto). */
const PORTION_G = 300;

type DraftComponent = {
  uid: number;
  canonical_key: string | null;
  label_it: string;
  grams: string;
  is_neutral: boolean;
};

let uidSeq = 1;
const nextUid = () => uidSeq++;

function draftFromRow(row: AdminMenuRecipeRow | null): DraftComponent[] {
  if (!row) return [];
  return row.components.map((c) => ({
    uid: nextUid(),
    canonical_key: c.canonical_key,
    label_it: c.label_it,
    grams: String(c.grams_per_100g),
    is_neutral: c.is_neutral,
  }));
}

/** Riga catalogo (GET /api/admin/menu-foods) → shape del validatore/calcolo macro. */
function toCatalogFood(f: AdminMenuFoodRow): RecipeCatalogFood {
  return {
    canonical_key: f.canonical_key,
    fdc_id: f.fdc_id,
    label_it: f.label_it,
    is_active: f.is_active,
    is_meat: f.is_meat,
    is_fish: f.is_fish,
    is_animal_product: f.is_animal_product,
    macro: f.macro,
  };
}

/**
 * Dialog UNICO per aggiunta e modifica ricetta (prop `mode`). A differenza degli
 * alimenti (aggiungi = ricerca USDA, modifica = fdc bloccato) qui il form è IDENTICO
 * nei due casi: nome, chiave, ingredienti con grammi, frequenza; cambia solo che in
 * modifica la recipe_key è bloccata e si fa PATCH invece di POST. Due componenti
 * sarebbero stati ~600 righe duplicate.
 *
 * La stessa `validateRecipeInput` usata dal server gira qui in anteprima: il bottone
 * Salva è disabilitato finché la ricetta non passerebbe, e il messaggio dice perché.
 */
export function AdminMenuRecipeDialog({
  mode,
  row,
  hasFrequencyColumns,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  row: AdminMenuRecipeRow | null;
  hasFrequencyColumns: boolean;
  onClose: () => void;
  onSaved: (recipe: AdminMenuRecipeRow) => void;
}) {
  const [catalog, setCatalog] = useState<AdminMenuFoodRow[] | null>(null);
  const [catalogErr, setCatalogErr] = useState(false);

  const [labelIt, setLabelIt] = useState(row?.label_it ?? "");
  const [recipeKey, setRecipeKey] = useState(row?.recipe_key ?? "");
  const [keyTouched, setKeyTouched] = useState(mode === "edit");
  const [note, setNote] = useState(row?.note ?? "");
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [frequency, setFrequency] = useState<RecipeFrequency>(row?.frequency ?? "COMMON");
  const [maxWeek, setMaxWeek] = useState(row?.max_week == null ? "" : String(row.max_week));
  const [rows, setRows] = useState<DraftComponent[]>(() => draftFromRow(row));

  const [q, setQ] = useState("");
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Catalogo dei ~500 alimenti del motore: una GET, poi filtro lato client.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/menu-foods", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; foods?: AdminMenuFoodRow[] };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setCatalogErr(true);
          return;
        }
        setCatalog(j.foods ?? []);
      } catch {
        if (!cancelled) setCatalogErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogMap = useMemo(() => {
    const m = new Map<string, RecipeCatalogFood>();
    for (const f of catalog ?? []) m.set(f.canonical_key, toCatalogFood(f));
    return m;
  }, [catalog]);

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2 || !catalog) return [];
    const used = new Set(rows.map((r) => r.canonical_key).filter(Boolean));
    return catalog
      .filter((f) => f.is_active && !used.has(f.canonical_key))
      .filter(
        (f) =>
          f.label_it.toLowerCase().includes(needle) ||
          f.canonical_key.includes(needle.replace(/\s+/g, "_")) ||
          (f.usdaDescription ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [q, catalog, rows]);

  const componentsInput = useMemo(
    () =>
      rows.map((r, i) => ({
        position: i + 1,
        canonical_key: r.canonical_key,
        label_it: r.label_it,
        grams_per_100g: r.grams,
        is_neutral: r.is_neutral,
      })),
    [rows],
  );

  const total = useMemo(() => sumRecipeGrams(componentsInput), [componentsInput]);
  const sumMsg = recipeGramsSumMessage(total);
  const sumOk = sumMsg == null;

  const macro = useMemo(
    () => computeRecipeMacrosPer100g(componentsInput, (k) => catalogMap.get(k)?.macro ?? null),
    [componentsInput, catalogMap],
  );
  const diet = useMemo(
    () => inheritRecipeDietFlags(componentsInput, (k) => catalogMap.get(k) ?? null),
    [componentsInput, catalogMap],
  );

  // Stessa validazione del server, in anteprima: dice PERCHÉ non si può salvare.
  const validation = useMemo(
    () =>
      validateRecipeInput(
        {
          recipe_key: recipeKey,
          label_it: labelIt,
          note,
          is_active: isActive,
          frequency,
          max_week: maxWeek,
          components: componentsInput,
        },
        (k) => catalogMap.get(k) ?? null,
      ),
    [recipeKey, labelIt, note, isActive, frequency, maxWeek, componentsInput, catalogMap],
  );
  const blocking = catalog ? (validation.ok ? null : validation.error) : COPY.catalogLoading;

  const onLabelChange = (v: string) => {
    setLabelIt(v);
    if (!keyTouched) setRecipeKey(recipeKeyFromLabel(v));
  };

  const addFood = (f: AdminMenuFoodRow) => {
    setRows((prev) => [
      ...prev,
      { uid: nextUid(), canonical_key: f.canonical_key, label_it: f.label_it, grams: "", is_neutral: false },
    ]);
    setQ("");
  };
  const addNeutral = () => {
    // Precompila i grammi con ciò che manca al 100 (se manca qualcosa): è il suo mestiere.
    const missing = Math.max(0, Number((100 - total).toFixed(2)));
    setRows((prev) => [
      ...prev,
      { uid: nextUid(), canonical_key: null, label_it: COPY.neutralLabel, grams: missing > 0 ? String(missing) : "", is_neutral: true },
    ]);
  };
  const setGrams = (uid: number, grams: string) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, grams } : r)));
  const removeRow = (uid: number) => setRows((prev) => prev.filter((r) => r.uid !== uid));

  const save = async () => {
    if (!validation.ok) return;
    setSaving(true);
    setServerErr(null);
    try {
      const payload: Record<string, unknown> = {
        label_it: labelIt.trim(),
        note: note.trim() || null,
        is_active: isActive,
        frequency,
        max_week: maxWeek.trim() === "" ? null : Number(maxWeek),
        components: componentsInput,
      };
      const url = mode === "add" ? "/api/admin/menu-recipes" : `/api/admin/menu-recipes/${encodeURIComponent(recipeKey)}`;
      if (mode === "add") payload.recipe_key = recipeKey.trim();
      const res = await fetch(url, {
        method: mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { ok?: boolean; recipe?: AdminMenuRecipeRow; error?: string };
      if (!res.ok || !j.ok || !j.recipe) {
        setServerErr(j.error ? `${COPY.errSavePrefix}: ${j.error}` : `${COPY.errSavePrefix}.`);
        return;
      }
      onSaved(j.recipe);
    } catch {
      setServerErr(`${COPY.errSavePrefix}: richiesta non riuscita.`);
    } finally {
      setSaving(false);
    }
  };

  const dietBadges: string[] = [];
  if (diet.is_meat) dietBadges.push(COPY.dietMeat);
  if (diet.is_fish) dietBadges.push(COPY.dietFish);
  if (diet.is_animal_product) dietBadges.push(COPY.dietAnimal);

  const portionFactor = PORTION_G / 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "add" ? COPY.titleAdd : COPY.titleEdit}
    >
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-white">{mode === "add" ? COPY.titleAdd : COPY.titleEdit}</h2>
            <p className="text-[11px] text-zinc-500">{COPY.subtitle}</p>
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
          {serverErr ? (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
              {serverErr}
            </p>
          ) : null}
          {catalogErr ? (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
              {COPY.catalogError}
            </p>
          ) : null}

          {/* Identità */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secIdentity}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="recipe-label">
                  {COPY.labelIt}
                </label>
                <input
                  id="recipe-label"
                  type="text"
                  value={labelIt}
                  onChange={(e) => onLabelChange(e.target.value)}
                  placeholder={COPY.labelPh}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="recipe-key">
                  {COPY.recipeKey}
                </label>
                <input
                  id="recipe-key"
                  type="text"
                  value={recipeKey}
                  disabled={mode === "edit"}
                  onChange={(e) => {
                    setKeyTouched(true);
                    setRecipeKey(e.target.value);
                  }}
                  className={cn(INPUT, "font-mono text-xs disabled:opacity-60")}
                />
                {mode === "edit" ? <p className="mt-1 text-[0.65rem] text-gray-600">{COPY.recipeKeyLocked}</p> : null}
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="recipe-note">
                {COPY.note}
              </label>
              <input
                id="recipe-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={COPY.notePh}
                className={INPUT}
              />
            </div>
            {mode === "edit" ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-400"
                />
                {COPY.isActive}
              </label>
            ) : null}
          </section>

          {/* Ingredienti */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secIngredients}</p>
            <p className="text-[0.65rem] text-gray-600">{COPY.ingredientsHint}</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={COPY.searchPh}
                aria-label={COPY.searchPh}
                disabled={!catalog}
                className={cn(INPUT, "pl-8")}
              />
            </div>
            {q.trim().length >= 2 ? (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10">
                {!catalog ? (
                  <p className="px-4 py-4 text-center text-xs text-gray-500">{COPY.catalogLoading}</p>
                ) : searchResults.length === 0 ? (
                  <p className="px-4 py-4 text-center text-xs text-gray-500">{COPY.noResults}</p>
                ) : (
                  <ul>
                    {searchResults.map((f) => (
                      <li key={f.canonical_key}>
                        <button
                          type="button"
                          onClick={() => addFood(f)}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[0.6rem] text-gray-500" aria-hidden>
                            <Plus className="h-3 w-3" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white">{f.label_it}</span>
                            <span className="block truncate font-mono text-[11px] text-zinc-500">
                              {f.canonical_key} · {fmtNum(f.macro.kcal)} kcal · C {fmtNum(f.macro.carbs)} · P {fmtNum(f.macro.protein)} · G {fmtNum(f.macro.fat)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : q.trim().length > 0 ? (
              <p className="text-[0.65rem] text-gray-600">{COPY.searchHint}</p>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">{COPY.thIngredient}</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">{COPY.thGrams}</th>
                    <th className="w-20 px-3 py-2 text-right font-medium text-amber-400/70">{COPY.thKcal}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-5 text-center text-xs text-gray-500">
                        {COPY.emptyRows}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const food = r.canonical_key ? catalogMap.get(r.canonical_key) : null;
                      const grams = Number(r.grams);
                      const kcalRow =
                        !r.is_neutral && food?.macro.kcal != null && Number.isFinite(grams) && grams > 0
                          ? (food.macro.kcal * grams) / 100
                          : null;
                      const gramsBad = !(Number.isFinite(grams) && grams > 0 && grams <= 100);
                      return (
                        <tr key={r.uid} className="border-b border-white/5 last:border-b-0">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {r.is_neutral ? <Droplets className="h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden /> : null}
                              <div className="min-w-0">
                                <p className={cn("truncate", r.is_neutral ? "text-sky-200" : "text-white")}>{r.label_it}</p>
                                <p className="truncate font-mono text-[10px] text-zinc-500">
                                  {r.is_neutral ? COPY.neutralHint : r.canonical_key}
                                  {!r.is_neutral && food && !food.is_active ? " · disattivato" : ""}
                                  {!r.is_neutral && catalog && !food ? " · non nel catalogo" : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0.01}
                              max={100}
                              step={0.5}
                              value={r.grams}
                              onChange={(e) => setGrams(r.uid, e.target.value)}
                              placeholder={COPY.gramsPh}
                              aria-label={`${COPY.thGrams}: ${r.label_it}`}
                              className={cn(
                                INPUT,
                                "w-24 text-right font-mono text-xs tabular-nums",
                                gramsBad && r.grams !== "" && "border-red-400/60",
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-amber-300">
                            {kcalRow == null ? (r.is_neutral ? "0" : "—") : fmtNum(kcalRow)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(r.uid)}
                              title={COPY.removeRow}
                              aria-label={`${COPY.removeRow}: ${r.label_it}`}
                              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-400 transition hover:border-rose-400/40 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addNeutral}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:bg-sky-500/20"
              >
                <Droplets className="h-3.5 w-3.5" aria-hidden />
                {COPY.addNeutral}
              </button>
            </div>

            {/* Barra della somma: verde in [99,101], rossa altrove */}
            <div
              className={cn(
                "rounded-xl border px-4 py-3",
                sumOk ? "border-emerald-400/40 bg-emerald-500/10" : "border-red-400/40 bg-red-500/10",
              )}
              role="status"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn("text-xs font-semibold", sumOk ? "text-emerald-200" : "text-red-200")}>
                  {COPY.sumLabel}
                </span>
                <span className={cn("font-mono text-sm tabular-nums", sumOk ? "text-emerald-200" : "text-red-200")}>
                  {fmtNum(total)} / 100 g
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-all", sumOk ? "bg-emerald-400" : "bg-red-400")}
                  style={{ width: `${Math.max(0, Math.min(100, total))}%` }}
                />
              </div>
              <p className={cn("mt-2 text-[0.7rem]", sumOk ? "text-emerald-300/80" : "text-red-300")}>
                {sumOk ? COPY.sumOk : `Attenzione: ${sumMsg}`}
              </p>
            </div>
          </section>

          {/* Macro live */}
          <section className="space-y-2">
            <p className={SECTION}>{COPY.secMacro}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  [COPY.kcalLabel, macro.kcal, "text-amber-300", ""],
                  [COPY.choLabel, macro.carbs, "text-sky-300", " g"],
                  [COPY.proLabel, macro.protein, "text-emerald-300", " g"],
                  [COPY.fatLabel, macro.fat, "text-rose-300", " g"],
                ] as const
              ).map(([label, value, tint, unit]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
                  <p className={cn("font-mono text-lg tabular-nums", tint)}>
                    {fmtNum(value)}
                    <span className="text-xs">{unit}</span>
                  </p>
                  <p className="text-[0.6rem] text-gray-600">{COPY.per100}</p>
                  <p className={cn("mt-1 font-mono text-[0.7rem] tabular-nums", tint)}>
                    {fmtNum(value * portionFactor)}
                    {unit} <span className="text-gray-600">· {COPY.portion(PORTION_G)}</span>
                  </p>
                </div>
              ))}
            </div>
            {macro.missing.length > 0 ? (
              <p className="text-[0.65rem] text-amber-300/80">{COPY.macroMissing(macro.missing)}</p>
            ) : null}
          </section>

          {/* Frequenza */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secFrequency}</p>
            {!hasFrequencyColumns ? (
              <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[0.7rem] text-amber-200">
                {COPY.frequencyNoColumns}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="recipe-frequency">
                  {COPY.frequency}
                </label>
                <select
                  id="recipe-frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecipeFrequency)}
                  className={INPUT}
                >
                  {RECIPE_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {RECIPE_FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="recipe-max-week">
                  {COPY.maxWeek}
                </label>
                <input
                  id="recipe-max-week"
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={maxWeek}
                  onChange={(e) => setMaxWeek(e.target.value)}
                  className={cn(INPUT, "font-mono text-xs")}
                />
              </div>
            </div>
            <p className="text-[0.65rem] text-gray-600">{COPY.frequencyHint}</p>
          </section>

          {/* Dieta ereditata */}
          <section className="space-y-2">
            <p className={SECTION}>{COPY.secDiet}</p>
            <div className="flex flex-wrap gap-2">
              {dietBadges.length === 0 ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[0.7rem] text-emerald-200">
                  {COPY.dietVeg}
                </span>
              ) : (
                dietBadges.map((b) => (
                  <span key={b} className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-[0.7rem] text-rose-100">
                    {b}
                  </span>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          {blocking ? <p className="mr-auto text-[0.7rem] text-amber-300/90">{blocking}</p> : null}
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
            disabled={saving || !!blocking}
            className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500/25 disabled:opacity-50"
          >
            {saving ? COPY.saving : mode === "add" ? COPY.saveAdd : COPY.saveEdit}
          </button>
        </div>
      </div>
    </div>
  );
}
