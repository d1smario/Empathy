"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Pencil, RefreshCw, Search, Tags } from "lucide-react";
import { cn } from "@/lib/cn";
import { AdminFoodEditDialog } from "@/components/admin/foods/AdminFoodEditDialog";
import { fmtNum, MACRO_TINT, type FoodImageItem, type FoodRow } from "@/components/admin/foods/food-types";

const PAGE_SIZE = 50;

const COPY = {
  loading: "Caricamento alimenti…",
  empty: "Nessun alimento trovato con i filtri correnti.",
  errPrefix: "Errore",
  reload: "Ricarica",
  searchPh: "Cerca per descrizione…",
  allCategories: "Tutte",
  refreshTags: "Ricalcola tag",
  refreshingTags: "Ricalcolo in corso…",
  refreshTagsConfirm:
    "Ricalcolare i tag derivati di tutti gli alimenti? L'operazione rigenera la vista fdc_food_tagged usata dal motore menù e può richiedere qualche secondo. Va fatta dopo ogni modifica ai valori nutrizionali.",
  refreshTagsDone: "Tag ricalcolati correttamente.",
  refreshTagsErrPrefix: "Ricalcolo tag fallito",
  tagsStale:
    "Hai modificato i valori nutrizionali di uno o più alimenti: i tag derivati non sono aggiornati. Premi «Ricalcola tag».",
  savedInfo: (id: number) => `Alimento #${id} salvato. Ricorda di ricalcolare i tag.`,
  imageUpdated: (id: number) => `Immagine dell'alimento #${id} caricata e collegata.`,
  edit: "Modifica",
  prev: "Precedenti",
  next: "Successivi",
  results: (from: number, to: number, total: number) =>
    total === 0 ? "0 risultati" : `${from}–${to} di ${total.toLocaleString("it-IT")} alimenti`,
  thKcal: "Kcal",
  thCarbs: "Carb",
  thProtein: "Prot",
  thFat: "Grassi",
  thFiber: "Fibre",
} as const;

/** Categoria distinta dal DB (RPC fdc_food_categories): selectableCount=0 → esclusa dal motore menù. */
type CategoryInfo = { name: string; total: number; selectableCount: number };

type FoodsJson = {
  ok?: boolean;
  foods?: FoodRow[];
  total?: number;
  categories?: CategoryInfo[];
  error?: string;
};

/**
 * Gestione Alimenti (DB USDA `fdc_food`) in stile console: filtri a pill per categoria,
 * ricerca server-side con debounce, tabella con thumbnail e macro, paginazione,
 * modifica per riga in dialog e «Ricalcola tag» per la matview `fdc_food_tagged`.
 * Tutto via API admin (service role lato server): /api/admin/foods*.
 */
export function AdminFoodsManager() {
  const [rows, setRows] = useState<FoodRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [offset, setOffset] = useState(0);
  const categoriesLoadedRef = useRef(false);

  const [images, setImages] = useState<FoodImageItem[]>([]);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  const [editing, setEditing] = useState<FoodRow | null>(null);
  const [tagsStale, setTagsStale] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);

  // Ricerca con debounce: al cambio query si riparte dalla prima pagina.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const loadFoods = useCallback(async (params: { q: string; category: string; offset: number }) => {
    setLoading(true);
    setErr(null);
    try {
      const sp = new URLSearchParams();
      if (params.q) sp.set("q", params.q);
      if (params.category) sp.set("category", params.category);
      sp.set("limit", String(PAGE_SIZE));
      sp.set("offset", String(params.offset));
      if (!categoriesLoadedRef.current) sp.set("include", "categories");
      const res = await fetch(`/api/admin/foods?${sp.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as FoodsJson;
      if (!res.ok || !j.ok) {
        setErr(`${COPY.errPrefix}: ${j.error ?? "impossibile caricare gli alimenti."}`);
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(j.foods ?? []);
      setTotal(j.total ?? 0);
      if (j.categories) {
        setCategories(j.categories);
        categoriesLoadedRef.current = true;
      }
    } catch {
      setErr(`${COPY.errPrefix}: richiesta non riuscita.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFoods({ q: debouncedQ, category, offset });
  }, [loadFoods, debouncedQ, category, offset]);

  // Lista immagini bucket: riusata dal dialog di modifica e ricaricata dopo un bulk-upload.
  const loadImages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/foods/images", { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; images?: FoodImageItem[]; error?: string };
      if (res.ok && j.ok) {
        setImages(j.images ?? []);
        setImagesError(null);
      } else {
        setImagesError(j.error ?? "Bucket immagini non disponibile.");
      }
    } catch {
      setImagesError("Bucket immagini non raggiungibile.");
    }
  }, []);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  // Bulk-upload libreria: carica più file in una volta nel bucket (cartella
  // `library/`), poi ricarica l'elenco così compaiono subito in «Seleziona dal
  // bucket» di ogni scheda. Non tocca gli alimenti.
  const onBulkFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = fileList ? Array.from(fileList) : [];
      if (!files.length) return;
      setBulkUploading(true);
      setErr(null);
      setInfo(null);
      try {
        const form = new FormData();
        for (const f of files) form.append("files", f);
        const res = await fetch("/api/admin/foods/bulk-upload", { method: "POST", body: form });
        const j = (await res.json()) as {
          ok?: boolean;
          uploaded?: unknown[];
          failed?: { name: string; error: string }[];
          error?: string;
        };
        if (!res.ok || !j.ok) {
          setErr(`Caricamento libreria fallito: ${j.error ?? "richiesta non riuscita."}`);
          return;
        }
        const okN = j.uploaded?.length ?? 0;
        const koN = j.failed?.length ?? 0;
        setInfo(
          `Libreria: ${okN} immagini caricate${koN ? `, ${koN} scartate (${j.failed!.map((f) => f.name).slice(0, 3).join(", ")}${koN > 3 ? "…" : ""})` : ""}. Ora sono in «Seleziona dal bucket».`,
        );
        await loadImages();
      } catch {
        setErr("Caricamento libreria fallito: richiesta non riuscita.");
      } finally {
        setBulkUploading(false);
      }
    },
    [loadImages],
  );

  const changeCategory = useCallback((next: string) => {
    setCategory(next);
    setOffset(0);
  }, []);

  const onSaved = useCallback((saved: FoodRow) => {
    setRows((prev) => prev.map((f) => (f.fdc_id === saved.fdc_id ? { ...f, ...saved } : f)));
    setEditing(null);
    setTagsStale(true);
    setInfo(COPY.savedInfo(saved.fdc_id));
  }, []);

  const onImageUploaded = useCallback(
    (fdcId: number, publicUrl: string) => {
      // L'upload ha già scritto image_url sul DB: thumbnail aggiornata subito in lista.
      setRows((prev) => prev.map((f) => (f.fdc_id === fdcId ? { ...f, image_url: publicUrl } : f)));
      setInfo(COPY.imageUpdated(fdcId));
    },
    [],
  );

  const refreshTags = useCallback(async () => {
    if (!window.confirm(COPY.refreshTagsConfirm)) return;
    setRefreshingTags(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/foods/refresh-tags", { method: "POST" });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(`${COPY.refreshTagsErrPrefix}: ${j.error ?? "richiesta non riuscita."}`);
        return;
      }
      setTagsStale(false);
      setInfo(COPY.refreshTagsDone);
    } catch {
      setErr(`${COPY.refreshTagsErrPrefix}: richiesta non riuscita.`);
    } finally {
      setRefreshingTags(false);
    }
  }, []);

  const pageFrom = total === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + PAGE_SIZE, total);

  const categoryPills = useMemo<(CategoryInfo | null)[]>(() => [null, ...categories], [categories]);

  return (
    <div className="space-y-4">
      {info ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {info}
        </p>
      ) : null}
      {tagsStale ? (
        <p className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          {COPY.tagsStale}
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
        {/* Toolbar: ricerca, ricarica, ricalcola tag */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
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
              className="w-48 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-gray-600 focus:border-amber-400/60 focus:outline-none sm:w-64"
            />
          </div>
          <p className="font-mono text-[0.65rem] tabular-nums text-zinc-500">{COPY.results(pageFrom, pageTo, total)}</p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadFoods({ q: debouncedQ, category, offset })}
              disabled={loading}
              title={COPY.reload}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            </button>
            <input
              ref={bulkInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onBulkFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => bulkInputRef.current?.click()}
              disabled={bulkUploading}
              title="Carica più immagini nel bucket per popolare «Seleziona dal bucket»"
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
            >
              <ImagePlus className={cn("h-3.5 w-3.5", bulkUploading && "animate-pulse")} aria-hidden />
              {bulkUploading ? "Caricamento libreria…" : "Carica libreria"}
            </button>
            <button
              type="button"
              onClick={() => void refreshTags()}
              disabled={refreshingTags}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                tagsStale
                  ? "border-cyan-400/60 bg-cyan-500/15 text-white hover:bg-cyan-500/25"
                  : "border-amber-400/60 bg-amber-500/15 text-white hover:bg-amber-500/25",
              )}
            >
              <Tags className="h-3.5 w-3.5" aria-hidden />
              {refreshingTags ? COPY.refreshingTags : COPY.refreshTags}
            </button>
          </div>
        </div>

        {/* Filtri a pill per categoria (tutte le 25 dal DB; ● = esclusa dal motore menù) */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 p-3">
          {categoryPills.map((c) => {
            const value = c?.name ?? "";
            const excluded = c != null && c.selectableCount === 0;
            return (
              <button
                key={value || "__all"}
                type="button"
                onClick={() => changeCategory(value)}
                title={
                  c == null
                    ? undefined
                    : excluded
                      ? `${c.total} alimenti — categoria ESCLUSA dal motore menù (selectable=false)`
                      : `${c.total} alimenti · ${c.selectableCount} idonei al menù`
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-medium transition",
                  category === value
                    ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-gray-200",
                  excluded && "opacity-75",
                )}
              >
                {excluded ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/80" aria-hidden /> : null}
                {value || COPY.allCategories}
                {c != null ? <span className="font-mono text-[0.6rem] text-gray-600">{c.total}</span> : null}
              </button>
            );
          })}
        </div>

        {err ? (
          <p className="px-4 py-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {/* Tabella alimenti */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Alimento</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className={cn("px-4 py-3 text-right font-medium", MACRO_TINT.kcal_100g.header)}>{COPY.thKcal}</th>
                <th className={cn("px-4 py-3 text-right font-medium", MACRO_TINT.carbs_100g.header)}>{COPY.thCarbs}</th>
                <th className={cn("px-4 py-3 text-right font-medium", MACRO_TINT.protein_100g.header)}>{COPY.thProtein}</th>
                <th className={cn("px-4 py-3 text-right font-medium", MACRO_TINT.fat_100g.header)}>{COPY.thFat}</th>
                <th className={cn("px-4 py-3 text-right font-medium", MACRO_TINT.fiber_100g.header)}>{COPY.thFiber}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-500">
                    {loading ? COPY.loading : COPY.empty}
                  </td>
                </tr>
              ) : (
                rows.map((f) => (
                  <tr
                    key={f.fdc_id}
                    className="border-b border-white/5 transition-colors even:bg-white/[0.015] last:border-b-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {f.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={f.image_url}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[0.6rem] text-gray-600"
                            aria-hidden
                          >
                            —
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{f.description}</p>
                          <p className="font-mono text-[11px] text-zinc-500">
                            #{f.fdc_id}
                            {f.source_dataset ? ` · ${f.source_dataset}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {f.food_category ? (
                        <span className="inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                          {f.food_category}
                        </span>
                      ) : (
                        <span className="text-[0.65rem] text-gray-600">—</span>
                      )}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono text-xs tabular-nums", MACRO_TINT.kcal_100g.value)}>
                      {fmtNum(f.kcal_100g)}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono text-xs tabular-nums", MACRO_TINT.carbs_100g.value)}>
                      {fmtNum(f.carbs_100g)}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono text-xs tabular-nums", MACRO_TINT.protein_100g.value)}>
                      {fmtNum(f.protein_100g)}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono text-xs tabular-nums", MACRO_TINT.fat_100g.value)}>
                      {fmtNum(f.fat_100g)}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono text-xs tabular-nums", MACRO_TINT.fiber_100g.value)}>
                      {fmtNum(f.fiber_100g)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setInfo(null);
                          setEditing(f);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:text-white"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                        {COPY.edit}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginazione */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3">
          <p className="font-mono text-[0.65rem] tabular-nums text-zinc-500">{COPY.results(pageFrom, pageTo, total)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              {COPY.prev}
            </button>
            <button
              type="button"
              disabled={loading || offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              {COPY.next}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {editing ? (
        <AdminFoodEditDialog
          food={editing}
          categories={categories.map((c) => c.name)}
          images={images}
          imagesError={imagesError}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onImageUploaded={(url) => onImageUploaded(editing.fdc_id, url)}
        />
      ) : null}
    </div>
  );
}
