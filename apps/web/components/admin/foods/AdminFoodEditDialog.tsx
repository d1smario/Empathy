"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  FOOD_NUMERIC_FIELDS,
  MACRO_TINT,
  type FoodImageItem,
  type FoodNumericField,
  type FoodRow,
} from "@/components/admin/foods/food-types";

const COPY = {
  title: "Modifica alimento",
  close: "Chiudi",
  cancel: "Annulla",
  save: "Salva modifiche",
  saving: "Salvataggio…",
  // Sezioni
  secIdentity: "Identità",
  secNutrition: "Valori nutrizionali (per 100 g)",
  secImage: "Immagine",
  // Campi
  description: "Descrizione",
  category: "Categoria",
  categoryPh: "es. Finfish and Shellfish Products",
  // Immagine
  upload: "Carica immagine",
  uploading: "Caricamento…",
  uploadHint: "JPG, PNG, WEBP, GIF o AVIF — max 5 MB. Salvata nel bucket e collegata subito all'alimento.",
  bucketFilter: "Filtra immagini dal bucket",
  bucketFilterPh: "es. salmone…",
  bucketSelect: "Seleziona dal bucket",
  bucketNone: "— nessuna selezione —",
  freeUrl: "Oppure URL libero",
  noImage: "Nessuna immagine",
  preview: "Anteprima alimento",
  // Errori
  errDescriptionRequired: "La descrizione è obbligatoria.",
  errNumeric: (label: string) => `${label}: deve essere un numero maggiore o uguale a 0 (o vuoto).`,
  errSavePrefix: "Salvataggio non riuscito",
  errUploadPrefix: "Upload immagine non riuscito",
  errUploadType: "Il file deve essere un'immagine (image/*).",
  errUploadSize: "Immagine troppo grande: massimo 5 MB.",
} as const;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-amber-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-400";

type FoodDraft = {
  description: string;
  food_category: string;
  image_url: string;
} & Record<FoodNumericField, string>;

function draftFromFood(f: FoodRow): FoodDraft {
  const draft = {
    description: f.description ?? "",
    food_category: f.food_category ?? "",
    image_url: f.image_url ?? "",
  } as FoodDraft;
  for (const { field } of FOOD_NUMERIC_FIELDS) {
    draft[field] = f[field] === null || f[field] === undefined ? "" : String(f[field]);
  }
  return draft;
}

function Field({
  label,
  className,
  labelClassName,
  children,
}: {
  label: string;
  className?: string;
  /** Tinta semantica opzionale della label (macro Console v2). */
  labelClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <span className={cn(LABEL, labelClassName)}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Dialog di modifica alimento (`fdc_food`): descrizione, categoria, macro per 100 g
 * e immagine con tre vie — upload diretto nel bucket, scelta dal bucket con filtro,
 * URL libero. PATCH via /api/admin/foods; upload via /api/admin/foods/upload-image
 * (aggiorna subito `image_url` sul DB).
 */
export function AdminFoodEditDialog({
  food,
  categories,
  images,
  imagesError,
  onClose,
  onSaved,
  onImageUploaded,
}: {
  food: FoodRow;
  /** Categorie note, usate come suggerimenti (datalist). */
  categories: string[];
  /** Immagini del bucket `food-images` per la scelta da dropdown. */
  images: FoodImageItem[];
  imagesError: string | null;
  onClose: () => void;
  /** Riga aggiornata dal PATCH: il padre aggiorna lista + stato "tag da ricalcolare". */
  onSaved: (saved: FoodRow) => void;
  /** L'upload scrive già `image_url` sul DB: il padre aggiorna subito la thumbnail in lista. */
  onImageUploaded: (publicUrl: string) => void;
}) {
  const [draft, setDraft] = useState<FoodDraft>(() => draftFromFood(food));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFilter, setImageFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof FoodDraft>(key: K, value: FoodDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const filteredImages = useMemo(() => {
    const f = imageFilter.trim().toLowerCase();
    if (!f) return images;
    return images.filter((img) => img.name.toLowerCase().includes(f));
  }, [images, imageFilter]);

  const uploadImage = async (file: File) => {
    setErrors([]);
    if (!file.type.startsWith("image/")) {
      setErrors([COPY.errUploadType]);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrors([COPY.errUploadSize]);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("fdcId", String(food.fdc_id));
      const res = await fetch("/api/admin/foods/upload-image", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
      if (!res.ok || !j.ok || !j.publicUrl) {
        setErrors([j.error ? `${COPY.errUploadPrefix}: ${j.error}` : `${COPY.errUploadPrefix}.`]);
        return;
      }
      set("image_url", j.publicUrl);
      onImageUploaded(j.publicUrl);
    } catch {
      setErrors([`${COPY.errUploadPrefix}: richiesta non riuscita.`]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = async () => {
    const found: string[] = [];
    if (!draft.description.trim()) found.push(COPY.errDescriptionRequired);

    const patch: Record<string, string | number | null> = {
      description: draft.description.trim(),
      food_category: draft.food_category.trim() || null,
      image_url: draft.image_url.trim() || null,
    };
    for (const { field, label } of FOOD_NUMERIC_FIELDS) {
      const raw = draft[field].trim().replace(",", ".");
      if (raw === "") {
        patch[field] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        found.push(COPY.errNumeric(label));
        continue;
      }
      patch[field] = value;
    }

    if (found.length > 0) {
      setErrors(found);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch("/api/admin/foods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fdcId: food.fdc_id, patch }),
      });
      const j = (await res.json()) as { ok?: boolean; food?: FoodRow; error?: string };
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

  const previewUrl = draft.image_url.trim();

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
              #{food.fdc_id}
              {food.source_dataset ? ` · ${food.source_dataset}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={COPY.close}
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
            <Field label={COPY.description}>
              <input
                type="text"
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label={COPY.category}>
              <input
                type="text"
                list="admin-foods-categories"
                value={draft.food_category}
                onChange={(e) => set("food_category", e.target.value)}
                placeholder={COPY.categoryPh}
                className={INPUT}
              />
              <datalist id="admin-foods-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </section>

          {/* Valori nutrizionali */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secNutrition}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FOOD_NUMERIC_FIELDS.map(({ field, label }) => (
                <Field key={field} label={label} labelClassName={MACRO_TINT[field].header}>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={draft[field]}
                    onChange={(e) => set(field, e.target.value)}
                    className={cn(INPUT, "text-right font-mono tabular-nums", MACRO_TINT[field].value)}
                  />
                </Field>
              ))}
            </div>
          </section>

          {/* Immagine: upload diretto, scelta dal bucket o URL libero */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secImage}</p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[220px] flex-1 space-y-3">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadImage(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    {uploading ? COPY.uploading : COPY.upload}
                  </button>
                  <p className="mt-1 text-[0.65rem] text-gray-600">{COPY.uploadHint}</p>
                </div>
                <Field label={`${COPY.bucketFilter} (${images.length})`}>
                  <input
                    type="search"
                    value={imageFilter}
                    onChange={(e) => setImageFilter(e.target.value)}
                    placeholder={COPY.bucketFilterPh}
                    className={INPUT}
                  />
                </Field>
                <Field label={COPY.bucketSelect}>
                  <select
                    value={images.some((img) => img.publicUrl === draft.image_url) ? draft.image_url : ""}
                    onChange={(e) => {
                      if (e.target.value) set("image_url", e.target.value);
                    }}
                    className={INPUT}
                  >
                    <option value="">{COPY.bucketNone}</option>
                    {filteredImages.map((img) => (
                      <option key={img.name} value={img.publicUrl}>
                        {img.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {imagesError ? <p className="text-xs text-amber-300">{imagesError}</p> : null}
                <Field label={COPY.freeUrl}>
                  <input
                    type="url"
                    value={draft.image_url}
                    onChange={(e) => set("image_url", e.target.value)}
                    placeholder="https://…"
                    className={cn(INPUT, "font-mono text-xs")}
                  />
                </Field>
              </div>
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={COPY.preview} className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-[0.65rem] text-gray-600">{COPY.noImage}</span>
                )}
              </div>
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
            disabled={saving || uploading}
            className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500/25 disabled:opacity-50"
          >
            {saving ? COPY.saving : COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
}
