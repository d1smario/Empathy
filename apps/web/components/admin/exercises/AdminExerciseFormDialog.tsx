"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  EXERCISE_SLUG_RE,
  type ExerciseMeta,
  type ExerciseRow,
} from "@/components/admin/exercises/exercise-types";

const COPY = {
  titleNew: "Aggiungi esercizio",
  titleEdit: "Modifica esercizio",
  close: "Chiudi",
  cancel: "Annulla",
  save: "Salva esercizio",
  saving: "Salvataggio…",
  // Sezioni
  secIdentity: "Identità",
  secClassification: "Classificazione",
  secEngine: "Motore (sistemi e carichi)",
  secLists: "Liste (chips: Invio o virgola per aggiungere)",
  secPayload: "Payload (JSON grezzo, opzionale)",
  // Campi
  id: "ID (slug)",
  idPh: "es. back_squat_barbell",
  name: "Nome",
  namePh: "es. Back Squat con bilanciere",
  slug: "Slug (opzionale)",
  imageUrl: "URL immagine",
  source: "Sorgente",
  domain: "Dominio",
  category: "Categoria",
  movementPattern: "Pattern di movimento",
  movementPatternPh: "es. squat, hinge, push…",
  difficulty: "Difficoltà",
  technicalScope: "Ambito tecnico",
  primarySystem: "Sistema primario",
  energySystem: "Sistema energetico",
  loadBand: "Fascia di carico",
  cnsLoad: "Carico SNC",
  lactateImpact: "Impatto lattacido",
  coordination: "Coordinazione",
  balance: "Equilibrio",
  technique: "Tecnica",
  muscleGroups: "Gruppi muscolari",
  equipment: "Attrezzatura",
  adaptationTargets: "Target di adattamento",
  sportTags: "Tag sport",
  secondarySystems: "Sistemi secondari",
  functionalGoals: "Obiettivi funzionali",
  metabolicGoals: "Obiettivi metabolici",
  technicalSports: "Sport tecnici",
  technicalTags: "Tag tecnici",
  gymChannels: "Canali gym",
  gymContractions: "Contrazioni gym",
  payloadPh: '{ "note": "metadati extra del motore" }',
  selectRequired: "— seleziona —",
  selectEmpty: "(non impostato)",
  tagPh: "valori separati da virgola",
  removeTag: "Rimuovi",
  // Errori
  errIdRequired: "L'ID (slug) è obbligatorio.",
  errIdSlug: "ID non valido: usare uno slug minuscolo (a-z, 0-9, trattini o underscore), 2-80 caratteri.",
  errNameRequired: "Il nome è obbligatorio.",
  errDomainRequired: "Il dominio è obbligatorio.",
  errSourceRequired: "La sorgente è obbligatoria.",
  errPayloadObject: "Il payload deve essere un oggetto JSON (es. { ... }).",
  errPayloadJson: "Payload: JSON non valido.",
  errSavePrefix: "Salvataggio non riuscito",
  errNetwork: "Errore di rete: richiesta non riuscita.",
} as const;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-400";

type ExerciseDraft = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  category: string;
  movement_pattern: string;
  difficulty: string;
  primary_system: string;
  energy_system: string;
  load_band: string;
  lactate_impact: string;
  cns_load: string;
  coordination: string;
  balance: string;
  technique: string;
  technical_scope: string;
  source: string;
  image_url: string;
  sport_tags: string[];
  muscle_groups: string[];
  equipment: string[];
  secondary_systems: string[];
  adaptation_targets: string[];
  functional_goals: string[];
  metabolic_goals: string[];
  technical_sports: string[];
  technical_tags: string[];
  gym_channels: string[];
  gym_contractions: string[];
  payloadText: string;
};

function draftFromExercise(e: ExerciseRow | null): ExerciseDraft {
  if (!e) {
    return {
      id: "",
      name: "",
      slug: "",
      domain: "",
      category: "",
      movement_pattern: "",
      difficulty: "",
      primary_system: "",
      energy_system: "",
      load_band: "",
      lactate_impact: "",
      cns_load: "",
      coordination: "",
      balance: "",
      technique: "",
      technical_scope: "",
      source: "admin_console",
      image_url: "",
      sport_tags: [],
      muscle_groups: [],
      equipment: [],
      secondary_systems: [],
      adaptation_targets: [],
      functional_goals: [],
      metabolic_goals: [],
      technical_sports: [],
      technical_tags: [],
      gym_channels: [],
      gym_contractions: [],
      payloadText: "",
    };
  }
  return {
    id: e.id,
    name: e.name ?? "",
    slug: e.slug ?? "",
    domain: e.domain ?? "",
    category: e.category ?? "",
    movement_pattern: e.movement_pattern ?? "",
    difficulty: e.difficulty ?? "",
    primary_system: e.primary_system ?? "",
    energy_system: e.energy_system ?? "",
    load_band: e.load_band ?? "",
    lactate_impact: e.lactate_impact ?? "",
    cns_load: e.cns_load ?? "",
    coordination: e.coordination ?? "",
    balance: e.balance ?? "",
    technique: e.technique ?? "",
    technical_scope: e.technical_scope ?? "",
    source: e.source ?? "",
    image_url: e.image_url ?? "",
    sport_tags: e.sport_tags ?? [],
    muscle_groups: e.muscle_groups ?? [],
    equipment: e.equipment ?? [],
    secondary_systems: e.secondary_systems ?? [],
    adaptation_targets: e.adaptation_targets ?? [],
    functional_goals: e.functional_goals ?? [],
    metabolic_goals: e.metabolic_goals ?? [],
    technical_sports: e.technical_sports ?? [],
    technical_tags: e.technical_tags ?? [],
    gym_channels: e.gym_channels ?? [],
    gym_contractions: e.gym_contractions ?? [],
    payloadText: e.payload && Object.keys(e.payload).length > 0 ? JSON.stringify(e.payload, null, 2) : "",
  };
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <span className={LABEL}>{label}</span>
      {children}
    </div>
  );
}

/** Input a chips: token separati da virgola o Invio, rimozione con ×, suggerimenti via datalist. */
function TagInput({
  value,
  onChange,
  suggestions,
  listId,
  ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  listId?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setDraft("");
      return;
    }
    const next = [...value];
    for (const p of parts) {
      if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 focus-within:border-violet-400/60">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-300"
          >
            {tag}
            <button
              type="button"
              aria-label={`${COPY.removeTag} ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-gray-500 transition hover:text-rose-300"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          list={listId}
          aria-label={ariaLabel}
          placeholder={value.length === 0 ? COPY.tagPh : ""}
          className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-white outline-none placeholder:text-gray-600"
        />
      </div>
      {suggestions && suggestions.length > 0 && listId ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <Field label={required ? `${label} *` : label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
        <option value="">{required ? COPY.selectRequired : COPY.selectEmpty}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Dialog crea/modifica esercizio: tutti i campi whitelisted di `public.exercise`,
 * select dagli enum reali (meta API), array come input a chips, payload JSON grezzo.
 * Salvataggio via POST/PATCH /api/admin/exercises.
 */
export function AdminExerciseFormDialog({
  exercise,
  meta,
  onClose,
  onSaved,
}: {
  /** null → creazione, valorizzato → modifica precompilata. */
  exercise: ExerciseRow | null;
  meta: ExerciseMeta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ExerciseDraft>(() => draftFromExercise(exercise));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isCreate = exercise === null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /** Upload foto → bucket `exercise-images`, aggiorna image_url e precompila il campo. */
  const uploadImage = async (file: File) => {
    if (!exercise?.id) return;
    setErrors([]);
    if (!file.type.startsWith("image/")) {
      setErrors(["Il file deve essere un'immagine."]);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(["Immagine troppo grande: massimo 5 MB."]);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("exerciseId", exercise.id);
      const res = await fetch("/api/admin/exercises/upload-image", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
      if (!res.ok || !j.ok || !j.publicUrl) {
        setErrors([j.error ? `Upload non riuscito: ${j.error}` : "Upload non riuscito."]);
        return;
      }
      set("image_url", j.publicUrl);
    } catch {
      setErrors(["Upload non riuscito: richiesta non riuscita."]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = async () => {
    const found: string[] = [];
    const id = draft.id.trim();
    if (isCreate) {
      if (!id) found.push(COPY.errIdRequired);
      else if (!EXERCISE_SLUG_RE.test(id)) found.push(COPY.errIdSlug);
    }
    if (!draft.name.trim()) found.push(COPY.errNameRequired);
    if (!draft.domain) found.push(COPY.errDomainRequired);
    if (!draft.source.trim()) found.push(COPY.errSourceRequired);

    let payload: Record<string, unknown> | undefined;
    if (draft.payloadText.trim()) {
      try {
        const parsed: unknown = JSON.parse(draft.payloadText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          found.push(COPY.errPayloadObject);
        } else {
          payload = parsed as Record<string, unknown>;
        }
      } catch {
        found.push(COPY.errPayloadJson);
      }
    }

    if (found.length > 0) {
      setErrors(found);
      return;
    }

    const fields: Record<string, unknown> = {
      name: draft.name.trim(),
      slug: draft.slug.trim() || null,
      domain: draft.domain,
      category: draft.category || null,
      movement_pattern: draft.movement_pattern.trim() || null,
      difficulty: draft.difficulty || null,
      primary_system: draft.primary_system || null,
      energy_system: draft.energy_system || null,
      load_band: draft.load_band || null,
      lactate_impact: draft.lactate_impact || null,
      cns_load: draft.cns_load || null,
      coordination: draft.coordination || null,
      balance: draft.balance || null,
      technique: draft.technique || null,
      technical_scope: draft.technical_scope || null,
      source: draft.source.trim(),
      image_url: draft.image_url.trim() || null,
      sport_tags: draft.sport_tags,
      muscle_groups: draft.muscle_groups,
      equipment: draft.equipment,
      secondary_systems: draft.secondary_systems,
      adaptation_targets: draft.adaptation_targets,
      functional_goals: draft.functional_goals,
      metabolic_goals: draft.metabolic_goals,
      technical_sports: draft.technical_sports,
      technical_tags: draft.technical_tags,
      gym_channels: draft.gym_channels,
      gym_contractions: draft.gym_contractions,
    };
    if (payload !== undefined) fields.payload = payload;

    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch("/api/admin/exercises", {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCreate ? { id, ...fields } : { id: exercise.id, patch: fields }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErrors([j.error ?? `${COPY.errSavePrefix}: risposta non valida.`]);
        return;
      }
      onSaved();
    } catch {
      setErrors([COPY.errNetwork]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isCreate ? COPY.titleNew : COPY.titleEdit}
    >
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">{isCreate ? COPY.titleNew : COPY.titleEdit}</h2>
            {!isCreate ? <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{exercise.id}</p> : null}
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
            <div className="grid gap-3 sm:grid-cols-2">
              {isCreate ? (
                <Field label={`${COPY.id} *`}>
                  <input
                    type="text"
                    value={draft.id}
                    onChange={(e) => set("id", e.target.value)}
                    placeholder={COPY.idPh}
                    autoComplete="off"
                    className={cn(INPUT, "font-mono")}
                  />
                </Field>
              ) : null}
              <Field label={`${COPY.name} *`}>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={COPY.namePh}
                  className={INPUT}
                />
              </Field>
              <Field label={COPY.slug}>
                <input
                  type="text"
                  value={draft.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  autoComplete="off"
                  className={cn(INPUT, "font-mono")}
                />
              </Field>
              <Field label={`${COPY.source} *`}>
                <input
                  type="text"
                  value={draft.source}
                  onChange={(e) => set("source", e.target.value)}
                  list="ex-form-sources"
                  autoComplete="off"
                  className={cn(INPUT, "font-mono")}
                />
                <datalist id="ex-form-sources">
                  {meta.sources.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label={COPY.imageUrl} className="sm:col-span-2">
                <input
                  type="url"
                  value={draft.image_url}
                  onChange={(e) => set("image_url", e.target.value)}
                  placeholder="https://…"
                  className={INPUT}
                />
                {isCreate ? (
                  <p className="mt-1 text-[0.65rem] text-gray-500">
                    Salva l&apos;esercizio per abilitare il caricamento della foto dal file.
                  </p>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadImage(f);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-100 hover:bg-orange-500/20 disabled:opacity-40"
                    >
                      {uploading ? "Caricamento…" : "Carica foto dal file"}
                    </button>
                    <span className="text-[0.6rem] text-gray-500">JPG/PNG/WebP · max 5 MB</span>
                  </div>
                )}
              </Field>
            </div>
          </section>

          {/* Classificazione */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secClassification}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label={COPY.domain}
                required
                value={draft.domain}
                onChange={(v) => set("domain", v)}
                options={meta.domains}
              />
              <SelectField
                label={COPY.category}
                value={draft.category}
                onChange={(v) => set("category", v)}
                options={meta.categories}
              />
              <Field label={COPY.movementPattern}>
                <input
                  type="text"
                  value={draft.movement_pattern}
                  onChange={(e) => set("movement_pattern", e.target.value)}
                  list="ex-form-movement-patterns"
                  placeholder={COPY.movementPatternPh}
                  autoComplete="off"
                  className={INPUT}
                />
                <datalist id="ex-form-movement-patterns">
                  {meta.movementPatterns.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <SelectField
                label={COPY.difficulty}
                value={draft.difficulty}
                onChange={(v) => set("difficulty", v)}
                options={meta.difficulties}
              />
              <SelectField
                label={COPY.technicalScope}
                value={draft.technical_scope}
                onChange={(v) => set("technical_scope", v)}
                options={meta.technicalScopes}
              />
            </div>
          </section>

          {/* Motore: sistemi e carichi */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secEngine}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label={COPY.primarySystem}
                value={draft.primary_system}
                onChange={(v) => set("primary_system", v)}
                options={meta.primarySystems}
              />
              <SelectField
                label={COPY.energySystem}
                value={draft.energy_system}
                onChange={(v) => set("energy_system", v)}
                options={meta.energySystems}
              />
              <SelectField
                label={COPY.loadBand}
                value={draft.load_band}
                onChange={(v) => set("load_band", v)}
                options={meta.loadBands}
              />
              <SelectField
                label={COPY.cnsLoad}
                value={draft.cns_load}
                onChange={(v) => set("cns_load", v)}
                options={meta.levels}
              />
              <SelectField
                label={COPY.lactateImpact}
                value={draft.lactate_impact}
                onChange={(v) => set("lactate_impact", v)}
                options={meta.levels}
              />
              <SelectField
                label={COPY.coordination}
                value={draft.coordination}
                onChange={(v) => set("coordination", v)}
                options={meta.levels}
              />
              <SelectField
                label={COPY.balance}
                value={draft.balance}
                onChange={(v) => set("balance", v)}
                options={meta.levels}
              />
              <SelectField
                label={COPY.technique}
                value={draft.technique}
                onChange={(v) => set("technique", v)}
                options={meta.levels}
              />
            </div>
          </section>

          {/* Liste (chips) */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secLists}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={COPY.muscleGroups}>
                <TagInput
                  value={draft.muscle_groups}
                  onChange={(v) => set("muscle_groups", v)}
                  suggestions={meta.muscleGroups}
                  listId="ex-form-muscle-groups"
                  ariaLabel={COPY.muscleGroups}
                />
              </Field>
              <Field label={COPY.equipment}>
                <TagInput
                  value={draft.equipment}
                  onChange={(v) => set("equipment", v)}
                  suggestions={meta.equipment}
                  listId="ex-form-equipment"
                  ariaLabel={COPY.equipment}
                />
              </Field>
              <Field label={COPY.adaptationTargets}>
                <TagInput
                  value={draft.adaptation_targets}
                  onChange={(v) => set("adaptation_targets", v)}
                  suggestions={meta.adaptationTargets}
                  listId="ex-form-adaptation-targets"
                  ariaLabel={COPY.adaptationTargets}
                />
              </Field>
              <Field label={COPY.sportTags}>
                <TagInput
                  value={draft.sport_tags}
                  onChange={(v) => set("sport_tags", v)}
                  suggestions={meta.sportTags}
                  listId="ex-form-sport-tags"
                  ariaLabel={COPY.sportTags}
                />
              </Field>
              <Field label={COPY.secondarySystems}>
                <TagInput
                  value={draft.secondary_systems}
                  onChange={(v) => set("secondary_systems", v)}
                  suggestions={meta.primarySystems}
                  listId="ex-form-secondary-systems"
                  ariaLabel={COPY.secondarySystems}
                />
              </Field>
              <Field label={COPY.functionalGoals}>
                <TagInput
                  value={draft.functional_goals}
                  onChange={(v) => set("functional_goals", v)}
                  ariaLabel={COPY.functionalGoals}
                />
              </Field>
              <Field label={COPY.metabolicGoals}>
                <TagInput
                  value={draft.metabolic_goals}
                  onChange={(v) => set("metabolic_goals", v)}
                  ariaLabel={COPY.metabolicGoals}
                />
              </Field>
              <Field label={COPY.technicalSports}>
                <TagInput
                  value={draft.technical_sports}
                  onChange={(v) => set("technical_sports", v)}
                  ariaLabel={COPY.technicalSports}
                />
              </Field>
              <Field label={COPY.technicalTags}>
                <TagInput
                  value={draft.technical_tags}
                  onChange={(v) => set("technical_tags", v)}
                  ariaLabel={COPY.technicalTags}
                />
              </Field>
              <Field label={COPY.gymChannels}>
                <TagInput
                  value={draft.gym_channels}
                  onChange={(v) => set("gym_channels", v)}
                  ariaLabel={COPY.gymChannels}
                />
              </Field>
              <Field label={COPY.gymContractions}>
                <TagInput
                  value={draft.gym_contractions}
                  onChange={(v) => set("gym_contractions", v)}
                  ariaLabel={COPY.gymContractions}
                />
              </Field>
            </div>
          </section>

          {/* Payload jsonb */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secPayload}</p>
            <textarea
              value={draft.payloadText}
              onChange={(e) => set("payloadText", e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder={COPY.payloadPh}
              aria-label={COPY.secPayload}
              className={cn(INPUT, "font-mono text-xs")}
            />
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
            className="rounded-lg border border-violet-400/60 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500/25 disabled:opacity-50"
          >
            {saving ? COPY.saving : COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
}
