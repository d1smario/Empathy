"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtNum } from "@/components/admin/foods/food-types";
import type { AdminMenuFoodRow } from "@/components/admin/foods/menu-food-types";
import { MENU_FOOD_POOL_ORDER, poolLabel } from "@/components/admin/foods/menu-food-pool-labels";
import { AdminMenuFoodEditDialog } from "@/components/admin/foods/AdminMenuFoodEditDialog";
import { AdminMenuFoodAddDialog } from "@/components/admin/foods/AdminMenuFoodAddDialog";

const COPY = {
  heading: "Catalogo menù",
  subtitle:
    "Gli alimenti che il motore usa davvero per comporre i menù (~300). La tabella Alimenti sopra è il database completo da 8.000; questo è il sottoinsieme approvato. Modifiche visibili nei nuovi piani entro pochi minuti.",
  loading: "Caricamento catalogo menù…",
  empty: "Nessun alimento nel catalogo menù con questo filtro.",
  errPrefix: "Errore",
  reload: "Ricarica",
  add: "Aggiungi alimento dal database",
  allPools: "Tutti",
  activeCount: (n: number) => `${n.toLocaleString("it-IT")} attivi`,
  totalCount: (active: number, total: number) =>
    `${active.toLocaleString("it-IT")} attivi · ${total.toLocaleString("it-IT")} in catalogo`,
  addedInfo: (label: string) => `«${label}» aggiunto al catalogo menù.`,
  savedInfo: (label: string) => `«${label}» aggiornato.`,
  deletedInfo: (label: string) => `«${label}» rimosso dal catalogo menù.`,
  deleteConfirm: (label: string) =>
    `Rimuovere «${label}» dal catalogo menù? Il motore smetterà di usarlo nei nuovi piani. L'alimento resta nel database USDA.`,
  toggleErrPrefix: "Aggiornamento stato non riuscito",
  deleteErrPrefix: "Eliminazione non riuscita",
  edit: "Modifica",
  delete: "Elimina",
  thFood: "Alimento",
  thPool: "Pool",
  thPriority: "Prio.",
  thKcal: "Kcal",
  thCarbs: "Carb",
  thProtein: "Prot",
  thFat: "Grassi",
  thDiet: "Dieta",
  thScore: "Score",
  scoreOk: "✓",
  scoreMissing: "manca",
  scoreOkTitle: (source: string) => `Ruoli e punteggi per pasto presenti (fonte: ${source})`,
  scoreMissingTitle: "Fuori grammatica: nessun ruolo/punteggio per pasto, il motore lo tratta senza ruolo",
  onlyWithoutScore: "Solo senza score",
  thActive: "Attivo",
  active: "Attivo",
  inactive: "Disattivato",
} as const;

type MenuFoodsJson = {
  ok?: boolean;
  foods?: AdminMenuFoodRow[];
  total?: number;
  byPool?: Record<string, number>;
  error?: string;
};

/** Badge dei flag dieta (carne/pesce/prodotto animale). */
function DietBadges({ row }: { row: AdminMenuFoodRow }) {
  const badges: { key: string; emoji: string; title: string }[] = [];
  if (row.is_meat) badges.push({ key: "meat", emoji: "🥩", title: "Carne" });
  if (row.is_fish) badges.push({ key: "fish", emoji: "🐟", title: "Pesce" });
  if (row.is_animal_product) badges.push({ key: "animal", emoji: "🥛", title: "Prodotto animale" });
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
 * Catalogo menù (public.nutrition_menu_foods): il sottoinsieme curato di ~300 cibi
 * che il motore meal-plan V2 usa per assemblare i pasti. Stessa estetica console
 * della Gestione Alimenti: filtri a pill per pool, tabella, toggle attivo, modifica
 * in dialog, eliminazione, aggiunta dal DB USDA. Tutto via /api/admin/menu-foods*.
 */
export function AdminMenuCatalogSection() {
  const [rows, setRows] = useState<AdminMenuFoodRow[]>([]);
  const [byPool, setByPool] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [pool, setPool] = useState<string>("");
  const [onlyWithoutScore, setOnlyWithoutScore] = useState(false);
  const [editing, setEditing] = useState<AdminMenuFoodRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/menu-foods", { cache: "no-store" });
      const j = (await res.json()) as MenuFoodsJson;
      if (!res.ok || !j.ok) {
        setErr(`${COPY.errPrefix}: ${j.error ?? "impossibile caricare il catalogo menù."}`);
        setRows([]);
        setByPool({});
        return;
      }
      setRows(j.foods ?? []);
      setByPool(j.byPool ?? {});
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

  const withoutScoreCount = useMemo(() => rows.filter((r) => !r.has_meal_roles).length, [rows]);

  const filteredRows = useMemo(() => {
    let list = pool ? rows.filter((r) => r.pool_keys.includes(pool)) : rows;
    if (onlyWithoutScore) list = list.filter((r) => !r.has_meal_roles);
    return list;
  }, [rows, pool, onlyWithoutScore]);

  // Ricalcolo locale dei conteggi per pool (solo attivi = ciò che vede il motore).
  const countByPool = useCallback((list: AdminMenuFoodRow[]) => {
    const counts: Record<string, number> = {};
    for (const r of list) {
      if (!r.is_active) continue;
      for (const k of r.pool_keys) counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, []);

  const applyRows = useCallback(
    (next: AdminMenuFoodRow[]) => {
      setRows(next);
      setByPool(countByPool(next));
    },
    [countByPool],
  );

  const onSaved = useCallback(
    (saved: AdminMenuFoodRow) => {
      setEditing(null);
      setInfo(COPY.savedInfo(saved.label_it));
      applyRows(rows.map((r) => (r.canonical_key === saved.canonical_key ? saved : r)));
    },
    [applyRows, rows],
  );

  const onAdded = useCallback(
    (added: AdminMenuFoodRow, warning?: string | null) => {
      setAdding(false);
      setInfo(COPY.addedInfo(added.label_it));
      // Alimento inserito ma score no: lo mostriamo come errore (non bloccante) accanto all'info.
      setErr(warning ?? null);
      const next = [...rows, added].sort(
        (a, b) => a.sort_priority - b.sort_priority || a.label_it.localeCompare(b.label_it, "it"),
      );
      applyRows(next);
    },
    [applyRows, rows],
  );

  const toggleActive = useCallback(
    async (row: AdminMenuFoodRow) => {
      setBusyKey(row.canonical_key);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch(`/api/admin/menu-foods/${encodeURIComponent(row.canonical_key)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !row.is_active }),
        });
        const j = (await res.json()) as { ok?: boolean; food?: AdminMenuFoodRow; error?: string };
        if (!res.ok || !j.ok || !j.food) {
          setErr(`${COPY.toggleErrPrefix}: ${j.error ?? "richiesta non riuscita."}`);
          return;
        }
        const saved = j.food;
        applyRows(rows.map((r) => (r.canonical_key === saved.canonical_key ? saved : r)));
      } catch {
        setErr(`${COPY.toggleErrPrefix}: richiesta non riuscita.`);
      } finally {
        setBusyKey(null);
      }
    },
    [applyRows, rows],
  );

  const remove = useCallback(
    async (row: AdminMenuFoodRow) => {
      if (!window.confirm(COPY.deleteConfirm(row.label_it))) return;
      setBusyKey(row.canonical_key);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch(`/api/admin/menu-foods/${encodeURIComponent(row.canonical_key)}`, {
          method: "DELETE",
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(`${COPY.deleteErrPrefix}: ${j.error ?? "richiesta non riuscita."}`);
          return;
        }
        setInfo(COPY.deletedInfo(row.label_it));
        applyRows(rows.filter((r) => r.canonical_key !== row.canonical_key));
      } catch {
        setErr(`${COPY.deleteErrPrefix}: richiesta non riuscita.`);
      } finally {
        setBusyKey(null);
      }
    },
    [applyRows, rows],
  );

  const poolPills = useMemo<(string | null)[]>(() => [null, ...MENU_FOOD_POOL_ORDER], []);

  return (
    <section className="mt-10 space-y-4" aria-label={COPY.heading}>
      {/* Intestazione sezione */}
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-white">{COPY.heading}</h2>
        <p className="max-w-3xl text-sm text-gray-400">{COPY.subtitle}</p>
        <p className="font-mono text-[0.7rem] tabular-nums text-amber-300">
          {COPY.totalCount(activeCount, rows.length)}
        </p>
      </div>

      {info ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {info}
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <p className="font-mono text-[0.65rem] tabular-nums text-zinc-500">{COPY.activeCount(activeCount)}</p>
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
                setAdding(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500/25"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {COPY.add}
            </button>
          </div>
        </div>

        {/* Filtri a pill per pool + filtro «solo senza score» */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 p-3">
          <button
            type="button"
            onClick={() => setOnlyWithoutScore((v) => !v)}
            aria-pressed={onlyWithoutScore}
            title={COPY.scoreMissingTitle}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-medium transition",
              onlyWithoutScore
                ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
                : withoutScoreCount > 0
                  ? "border-rose-400/30 bg-rose-500/5 text-rose-300 hover:border-rose-400/50"
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
            )}
          >
            {COPY.onlyWithoutScore}
            <span className="font-mono text-[0.6rem] text-gray-500">{withoutScoreCount}</span>
          </button>
          <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />
          {poolPills.map((p) => {
            const value = p ?? "";
            const count = p == null ? activeCount : byPool[p] ?? 0;
            return (
              <button
                key={value || "__all"}
                type="button"
                onClick={() => setPool(value)}
                title={p == null ? undefined : `${count} attivi in ${poolLabel(p)}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-medium transition",
                  pool === value
                    ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
                )}
              >
                {p == null ? COPY.allPools : poolLabel(p)}
                <span className="font-mono text-[0.6rem] text-gray-600">{count}</span>
              </button>
            );
          })}
        </div>

        {err ? (
          <p className="px-4 py-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {/* Tabella */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">{COPY.thFood}</th>
                <th className="px-4 py-3 font-medium">{COPY.thPool}</th>
                <th className="px-4 py-3 text-right font-medium">{COPY.thPriority}</th>
                <th className="px-4 py-3 text-right font-medium text-amber-400/70">{COPY.thKcal}</th>
                <th className="px-4 py-3 text-right font-medium text-sky-400/70">{COPY.thCarbs}</th>
                <th className="px-4 py-3 text-right font-medium text-emerald-400/70">{COPY.thProtein}</th>
                <th className="px-4 py-3 text-right font-medium text-rose-400/70">{COPY.thFat}</th>
                <th className="px-4 py-3 font-medium">{COPY.thDiet}</th>
                <th className="px-4 py-3 font-medium">{COPY.thScore}</th>
                <th className="px-4 py-3 font-medium">{COPY.thActive}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-xs text-gray-500">
                    {loading ? COPY.loading : COPY.empty}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr
                    key={r.canonical_key}
                    className={cn(
                      "border-b border-white/5 transition-colors even:bg-white/[0.015] last:border-b-0 hover:bg-white/[0.04]",
                      !r.is_active && "opacity-45",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{r.label_it}</p>
                        <p className="truncate font-mono text-[11px] text-zinc-500">{r.canonical_key}</p>
                        {r.usdaDescription ? (
                          <p className="truncate text-[10px] text-gray-600">{r.usdaDescription}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.pool_keys.map((k) => (
                          <span
                            key={k}
                            className="inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300"
                          >
                            {poolLabel(k)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-300">
                      {r.sort_priority}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-amber-300">
                      {fmtNum(r.macro.kcal)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-sky-300">
                      {fmtNum(r.macro.carbs)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-300">
                      {fmtNum(r.macro.protein)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-rose-300">
                      {fmtNum(r.macro.fat)}
                    </td>
                    <td className="px-4 py-3">
                      <DietBadges row={r} />
                    </td>
                    <td className="px-4 py-3">
                      {r.has_meal_roles ? (
                        <span
                          title={COPY.scoreOkTitle(r.meal_roles?.source_version ?? "?")}
                          className="inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300"
                        >
                          {COPY.scoreOk}
                        </span>
                      ) : (
                        <span
                          title={COPY.scoreMissingTitle}
                          className="inline-block rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300"
                        >
                          {COPY.scoreMissing}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.is_active}
                        aria-label={`${r.is_active ? COPY.active : COPY.inactive}: ${r.label_it}`}
                        disabled={busyKey === r.canonical_key}
                        onClick={() => void toggleActive(r)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition disabled:opacity-50",
                          r.is_active
                            ? "border-emerald-400/50 bg-emerald-500/30"
                            : "border-white/15 bg-white/10",
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
                            setEditing(r);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:text-white"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          {COPY.edit}
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === r.canonical_key}
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

      {editing ? (
        <AdminMenuFoodEditDialog row={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
      ) : null}
      {adding ? <AdminMenuFoodAddDialog onClose={() => setAdding(false)} onAdded={onAdded} /> : null}
    </section>
  );
}
