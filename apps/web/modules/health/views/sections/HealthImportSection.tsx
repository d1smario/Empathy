"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Dna, Droplets, Heart, HeartPulse, Upload, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";

/** Tipi di esame supportati dall'import. Il primo (blood) è la scelta di default. */
export const HEALTH_EXAM_TYPES = [
  {
    panelType: "blood",
    title: "Esami del sangue",
    desc: "Emocromo, metaboliti, vitamine, minerali",
    tags: ["Emoglobina", "Ferritina", "Vitamina D", "B12", "Glicemia", "HbA1c"],
    accent: "rose",
    icon: Droplets,
  },
  {
    panelType: "microbiota",
    title: "Analisi microbiota",
    desc: "Flora batterica intestinale, disbiosi",
    tags: ["Firmicutes", "Bacteroidetes", "Proteobacteria", "Diversità α", "SCFA"],
    accent: "emerald",
    icon: HeartPulse,
  },
  {
    panelType: "epigenetics",
    title: "Test epigenetico",
    desc: "Metilazione DNA, espressione genica",
    tags: ["Metilazione", "Età biologica", "Stress ossidativo", "Detox"],
    accent: "violet",
    icon: Dna,
  },
  {
    panelType: "hormones",
    title: "Profilo ormonale",
    desc: "Cortisolo, testosterone, ormoni tiroidei",
    tags: ["Cortisolo", "Testosterone", "TSH", "T3", "T4", "DHEA"],
    accent: "orange",
    icon: Heart,
  },
  {
    panelType: "inflammation",
    title: "Markers infiammazione",
    desc: "PCR, citochine, omocisteina",
    tags: ["PCR-us", "IL-6", "TNF-α", "Omocisteina", "LDL-ox"],
    accent: "amber",
    icon: AlertTriangle,
  },
  {
    panelType: "oxidative_stress",
    title: "Stress ossidativo",
    desc: "Radicali liberi, capacità antiossidante",
    tags: ["d-ROMs", "BAP", "Glutatione", "SOD", "Catalasi"],
    accent: "sky",
    icon: Zap,
  },
] as const;

/**
 * Pill di selezione tipo esame: forma canonica (rounded-full, accento modulo rose).
 * Una sola variante, attiva/inattiva — l'accento per-esame non si usa più.
 */
const TYPE_PILL = {
  active: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  idle: "border-white/15 bg-white/5 text-gray-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200",
} as const;

export interface HealthImportSectionProps {
  sampleDate: string;
  onSampleDateChange: (value: string) => void;
  /** Riusa onPickFile esistente → uploadHealthDocument (nessuna nuova API). */
  onPickFile: (panelType: string, file: File | null) => void;
  uploadBusy: string | null;
  loadingTimeline?: boolean;
  timelineErr?: string | null;
}

/**
 * PRIMARY JOB del modulo Salute, sopra la piega.
 * - selettore data campione
 * - selettore tipo esame (le 6 scelte di IMPORT_CARDS)
 * - UNA SOLA CTA primaria «Carica esame» (default `blood`).
 * Il flusso di upload esistente ritorna `reviewUrl` → redirect /health/staging/<id>.
 */
export function HealthImportSection({
  sampleDate,
  onSampleDateChange,
  onPickFile,
  uploadBusy,
  loadingTimeline = false,
  timelineErr = null,
}: HealthImportSectionProps) {
  const t = useTranslations("HealthImportSection");
  const [selectedType, setSelectedType] = useState<string>(HEALTH_EXAM_TYPES[0].panelType);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const active = HEALTH_EXAM_TYPES.find((t) => t.panelType === selectedType) ?? HEALTH_EXAM_TYPES[0];
  const ActiveIcon = active.icon;
  const busy = uploadBusy === selectedType;

  return (
    <section
      id="mod-import"
      className="scroll-mt-20 rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-4 shadow-inner sm:scroll-mt-28 sm:p-6"
      aria-label={t("uploadExamAria")}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">{t("reportsLabel")}</p>
          <h2 className="mt-1 text-lg font-bold text-white">{t("uploadExamTitle")}</h2>
          <p className="mt-1 text-sm text-gray-400">
            {t("uploadHint")}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-gray-400">
          {t("sampleDateLabel")}
          <input
            type="date"
            className="rounded-xl border border-white/15 bg-black/40 px-2 py-1 font-mono tabular-nums text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            value={sampleDate}
            onChange={(e) => onSampleDateChange(e.target.value)}
          />
        </label>
      </div>

      <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("examTypeLabel")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {HEALTH_EXAM_TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = t.panelType === selectedType;
          return (
            <button
              key={t.panelType}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSelectedType(t.panelType)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold transition-colors ${
                isActive ? TYPE_PILL.active : TYPE_PILL.idle
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              {t.title}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <ActiveIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{active.title}</p>
            <p className="mt-0.5 text-sm text-gray-400">{active.desc}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {active.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-rose-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          onPickFile(selectedType, f ?? null);
          e.target.value = "";
        }}
      />
      <Pro2Button
        type="button"
        className="mt-4 w-full justify-center bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:brightness-110"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? (
          t("sending")
        ) : (
          <>
            <Upload className="mr-2 h-5 w-5" strokeWidth={2.5} />
            {t("uploadExamButton")}
          </>
        )}
      </Pro2Button>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500">
        {timelineErr ? <span className="text-amber-300">{timelineErr}</span> : null}
        {loadingTimeline ? <span>{t("syncingArchive")}</span> : null}
      </div>
    </section>
  );
}
