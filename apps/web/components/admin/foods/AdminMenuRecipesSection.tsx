"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtNum } from "@/components/admin/foods/food-types";
import { RECIPE_FREQUENCY_LABELS, type AdminMenuRecipeRow } from "@/components/admin/foods/menu-recipe-types";
import { AdminMenuRecipeDialog } from "@/components/admin/foods/AdminMenuRecipeDialog";

const COPY = {
  heading: "Ricette",
  subtitle:
    "Regole di combinazione su alimenti del catalogo menù (grammatica di Mario): la ricetta non ha macro proprie, si calcolano dagli ingredienti per 100 g di piatto. Il motore legge solo le ricette attive e in tolleranza.",
  loading: "Caricamento ricette…",
  empty: "Nessuna ricetta.",
  errPrefix: "Errore",
  reload: "Ricarica",
  add: "Aggiungi ricetta",
  totalCount: (active: number, total: number) =>
    `${active.toLocaleString("it-IT")} attive · ${total.toLocaleString("it-IT")} in archivio`,
  noFrequencyColumns:
    "Migration frequency/max_week NON applicata: i campi frequenza delle ricette si vedono ma non vengono salvati (supabase/migrations/20260819110000_nutrition_recipes_frequency.sql).",
  addedInfo: (label: string) => `«${label}» creata.`,
  savedInfo: (label: string) => `«${label}» aggiornata.`,
  deletedInfo: (label: string) => `«${label}» eliminata.`,
  deleteConfirm: (label: string) =>
    `Eliminare la ricetta «${label}»? Se è già stata servita in un piano verrà rifiutata: in quel caso disattivala.`,
  toggleErrPrefix: "Aggiornamento stato non riuscito",
  deleteErrPrefix: "Eliminazione non riuscita",
  edit: "Modifica",
  delete: "Elimina",
  thRecipe: "Ricetta",
  thIngredients: "Ingredienti",
  thKcal: "Kcal/100 g",
  thCarbs: "Carb",
  thProtein: "Prot",
  thFat: "Grassi",
  thDiet: "Dieta",
  thFrequency: "Frequenza",
  thEngine: "Motore",
  thActive: "Attiva",
  active: "Attiva",
  inactive: "Disattivata",
  engineOk: "ok",
  engineIssue: "scartata",
  neutral: "neutro",
  maxWeek: (n: number) => `max ${n}/sett.`,
} as const;

type RecipesJson = {
  ok?: boolean;
  recipes?: AdminMenuRecipeRow[];
  total?: number;
  hasFrequencyColumns?: boolean;
  error?: string;
};

function DietBadges({ row }: { row: AdminMenuRecipeRow }) {
  const badges: { key: string; emoji: string; title: string }[] = [];
  if (row.diet.is_meat) badges.push({ key: "meat", emoji: "🥩", title: "Contiene carne" });
  if (row.diet.is_fish) badges.push({ key: "fish", emoji: "🐟", title: "Contiene pesce" });
  if (row.diet.is_animal_product) badges.push({ key: "animal", emoji: "🥛", title: "Origine animale" });
  if (badges.length === 0) return <span className="text-[0.65rem] text-gray-600">vegetale</span>;
  return (
    <span className="flex items-center gap-1">
      {badges.map((b) => (
        <span key={b.key} title={b.title} aria-label={b.title} className="text-sm leading-none">
          {b.emoji}
        </span>
      ))}
    </span>
  );
}

/**
 * Ricette (public.nutrition_recipes + nutrition_recipe_components): tabella con macro
 * calcolate, flag dieta ereditati, esito «motore» (la vedrebbe o la scarterebbe),
 * toggle attiva, modifica/aggiunta in dialog, eliminazione. Tutto via /api/admin/menu-recipes*.
 */
export function AdminMenuRecipesSection() {
  const [rows, setRows] = useState<AdminMenuRecipeRow[]>([]);
  const [hasFrequencyColumns, setHasFrequencyColumns] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: AdminMenuRecipeRow } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/menu-recipes", { cache: "no-store" });
      const j = (await res.json()) as RecipesJson;
      if (!res.ok || !j.ok) {
        setErr(`${COPY.errPrefix}: ${j.error ?? "impossibile caricare le ricette."}`);
        setRows([]);
        return;
      }
      setRows(j.recipes ?? []);
      setHasFrequencyColumns(j.hasFrequencyColumns !== false);
    } catch {
      setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

  const sortRows = (list: AdminMenuRecipeRow[]) =>
    [...list].sort((a, b) => a.label_it.localeCompare(b.label_it, "it"));

  const onSaved = useCallback(
    (saved: AdminMenuRecipeRow) => {
      const isNew = !rows.some((r) => r.recipe_key === saved.recipe_key);
      setDialog(null);
      setInfo(isNew ? COPY.addedInfo(saved.label_it) : COPY.savedInfo(saved.label_it));
      setRows(
        sortRows(isNew ? [...rows, saved] : rows.map((r) => (r.recipe_key === saved.recipe_key ? saved : r))),
      );
    },
    [rows],
  );

  const toggleActive = useCallback(
    async (row: AdminMenuRecipeRow) => {
      setBusyKey(row.recipe_key);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch(`/api/admin/menu-recipes/${encodeURIComponent(row.recipe_key)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !row.is_active }),
        });
        const j = (await res.json()) as { ok?: boolean; recipe?: AdminMenuRecipeRow; error?: string };
        if (!res.ok || !j.ok || !j.recipe) {
          setErr(`${COPY.toggleErrPrefix}: ${j.error ?? "richiesta non riuscita."}`);
          return;
        }
        const saved = j.recipe;
        setRows(rows.map((r) => (r.recipe_key === saved.recipe_key ? saved : r)));
      } catch {
        setErr(`${COPY.toggleErrPrefix}: richiesta non riuscita.`);
      } finally {
        setBusyKey(null);
      }
    },
    [rows],
  );

  const remove = useCallback(
    async (row: AdminMenuRecipeRow) => {
      if (!window.confirm(COPY.deleteConfirm(row.label_it))) return;
      setBusyKey(row.recipe_key);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch(`/api/admin/menu-recipes/${encodeURIComponent(row.recipe_key)}`, { method: "DELETE" });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(`${COPY.deleteErrPrefix}: ${j.error ?? "richiesta non riuscita."}`);
          return;
        }
        setInfo(COPY.deletedInfo(row.label_it));
        setRows(rows.filter((r) => r.recipe_key !== row.recipe_key));
      } catch {
        setErr(`${COPY.deleteErrPrefix}: richiesta non riuscita.`);
      } finally {
        setBusyKey(null);
      }
    },
    [rows],
  );

  return (
    <section className="mt-10 space-y-4" aria-label={COPY.heading}>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-white">{COPY.heading}</h2>
        <p className="max-w-3xl text-sm text-gray-400">{COPY.subtitle}</p>
        <p className="font-mono text-[0.7rem] tabular-nums text-amber-300">{COPY.totalCount(activeCount, rows.length)}</p>
      </div>

      {info ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{info}</p>
      ) : null}
      {!loading && !hasFrequencyColumns ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {COPY.noFrequencyColumns}
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title={COPY.reload}
              aria-label={COPY.reload}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setInfo(null);
                setDialog({ mode: "add" });
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500/25"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {COPY.add}
            </button>
          </div>
        </div>

        {err ? (
          <p className="px-4 py-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">{COPY.thRecipe}</th>
                <th className="px-4 py-3 font-medium">{COPY.thIngredients}</th>
                <th className="px-4 py-3 text-right font-medium text-amber-400/70">{COPY.thKcal}</th>
                <th className="px-4 py-3 text-right font-medium text-sky-400/70">{COPY.thCarbs}</th>
                <th className="px-4 py-3 text-right font-medium text-emerald-400/70">{COPY.thProtein}</th>
                <th className="px-4 py-3 text-right font-medium text-rose-400/70">{COPY.thFat}</th>
                <th className="px-4 py-3 font-medium">{COPY.thDiet}</th>
                <th className="px-4 py-3 font-medium">{COPY.thFrequency}</th>
                <th className="px-4 py-3 font-medium">{COPY.thEngine}</th>
                <th className="px-4 py-3 font-medium">{COPY.thActive}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-xs text-gray-500">
                    {loading ? COPY.loading : COPY.empty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.recipe_key}
                    className={cn(
                      "border-b border-white/5 transition-colors even:bg-white/[0.015] last:border-b-0 hover:bg-white/[0.04]",
                      !r.is_active && "opacity-45",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{r.label_it}</p>
                        <p className="truncate font-mono text-[11px] text-zinc-500">{r.recipe_key}</p>
                        {r.note ? <p className="truncate text-[10px] text-gray-600">{r.note}</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-md flex-wrap gap-1">
                        {r.components.map((c) => (
                          <span
                            key={c.position}
                            title={c.is_neutral ? COPY.neutral : c.canonical_key ?? ""}
                            className={cn(
                              "inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              c.is_neutral
                                ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
                                : c.catalog_is_active === false || (c.canonical_key && c.catalog_label_it == null)
                                  ? "border-red-400/30 bg-red-400/10 text-red-300"
                                  : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
                            )}
                          >
                            {c.label_it} <span className="font-mono opacity-70">{fmtNum(c.grams_per_100g)}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-amber-300">{fmtNum(r.macro.kcal)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-sky-300">{fmtNum(r.macro.carbs)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-300">{fmtNum(r.macro.protein)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-rose-300">{fmtNum(r.macro.fat)}</td>
                    <td className="px-4 py-3">
                      <DietBadges row={r} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {r.frequency ? RECIPE_FREQUENCY_LABELS[r.frequency] : "—"}
                      {r.max_week != null ? (
                        <span className="block font-mono text-[10px] text-zinc-500">{COPY.maxWeek(r.max_week)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {r.engine_ok ? (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                          {COPY.engineOk}
                        </span>
                      ) : (
                        <span
                          title={r.engine_issue ?? undefined}
                          className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-200"
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          {COPY.engineIssue}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.is_active}
                        aria-label={`${r.is_active ? COPY.active : COPY.inactive}: ${r.label_it}`}
                        disabled={busyKey === r.recipe_key}
                        onClick={() => void toggleActive(r)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition disabled:opacity-50",
                          r.is_active ? "border-emerald-400/50 bg-emerald-500/30" : "border-white/15 bg-white/10",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition",
                            r.is_active ? "translate-x-4" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setInfo(null);
                            setDialog({ mode: "edit", row: r });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:text-white"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          {COPY.edit}
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === r.recipe_key}
                          onClick={() => void remove(r)}
                          title={COPY.delete}
                          aria-label={`${COPY.delete}: ${r.label_it}`}
                          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-400 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialog ? (
        <AdminMenuRecipeDialog
          mode={dialog.mode}
          row={dialog.mode === "edit" ? dialog.row : null}
          hasFrequencyColumns={hasFrequencyColumns}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      ) : null}
    </section>
  );
}
