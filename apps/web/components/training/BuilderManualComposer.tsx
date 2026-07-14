"use client";

import {
  ChevronLeft,
  ChevronRight,
  Footprints,
  Gauge,
  GripVertical,
  Heart,
  Layers,
  Mountain,
  Plus,
  Repeat2,
  Timer,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { BuilderCalendarSaveConfirm } from "@/components/training/BuilderCalendarSaveConfirm";
import { defaultManualPlanBlock, type ManualPlanBlock, type PlanBlockKind } from "@/lib/training/builder/manual-plan-block";
import type { SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import {
  colorForIntensity,
  PRO2_INTENSITY_OPTIONS,
  zoneRangeLabel,
  type Pro2IntensityLabel,
  type Pro2IntensityUnit,
} from "@/lib/training/builder/pro2-intensity";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import { SESSION_DURATION_CHOICES } from "@/lib/training/builder/session-duration-choices";

function rangeShort(z: string, unit: Pro2IntensityUnit, ftpW: number, hrMax: number): string {
  const raw = zoneRangeLabel(z, unit, ftpW, hrMax);
  const tail = raw.replace(/^(Z\d|LT\d|FatMax)\s*/i, "").trim();
  return tail || raw;
}

function ZoneStrip({
  label,
  value,
  onPick,
  unit,
  ftpW,
  hrMax,
}: {
  label: string;
  value: Pro2IntensityLabel;
  onPick: (z: Pro2IntensityLabel) => void;
  unit: Pro2IntensityUnit;
  ftpW: number;
  hrMax: number;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {PRO2_INTENSITY_OPTIONS.map((z) => {
          const sel = z === value;
          const bg = colorForIntensity(z);
          return (
            <button
              key={z}
              type="button"
              onClick={() => onPick(z)}
              className={`min-w-[3.25rem] rounded-xl border-2 px-2 py-1.5 text-center text-[0.7rem] font-bold text-black shadow-md transition ${
                sel ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-[1.02]" : "opacity-85 hover:opacity-100"
              }`}
              style={{ backgroundColor: bg, borderColor: sel ? "#fff" : `${bg}99` }}
              title={zoneRangeLabel(z, unit, ftpW, hrMax)}
            >
              <span className="block leading-tight">{z}</span>
              <span className="mt-0.5 block text-[0.58rem] font-semibold leading-tight opacity-90">
                {rangeShort(z, unit, ftpW, hrMax)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Colore per TIPO di blocco (la forma nel grafico usa la zona; qui il tipo si
// riconosce a colpo d'occhio invece che essere tutto arancione).
const KIND_META: { kind: PlanBlockKind; label: string; icon: typeof Timer; color: string; iconClass: string }[] = [
  { kind: "steady", label: "Steady", icon: Timer, color: "from-sky-500/90 to-blue-600/90", iconClass: "text-sky-100" },
  { kind: "ramp", label: "Ramp", icon: TrendingUp, color: "from-amber-500/90 to-orange-600/90", iconClass: "text-amber-100" },
  { kind: "interval2", label: "2 phases", icon: Repeat2, color: "from-emerald-500/90 to-teal-600/90", iconClass: "text-emerald-100" },
  { kind: "interval3", label: "3 phases", icon: Layers, color: "from-violet-500/90 to-purple-600/90", iconClass: "text-violet-100" },
  { kind: "pyramid", label: "Pyramid", icon: Mountain, color: "from-pink-500/90 to-rose-600/90", iconClass: "text-pink-100" },
];

type KindMetaRow = (typeof KIND_META)[number];

function kindMetaForFamily(f: SportMacroId): KindMetaRow[] {
  if (f === "technical") return KIND_META.filter((k) => k.kind !== "pyramid");
  return KIND_META;
}

function manualPresetTechnicalDrills(): ManualPlanBlock[] {
  const w = defaultManualPlanBlock("steady", "Ingresso");
  w.minutes = 15;
  w.intensity = "Z2";
  const d = defaultManualPlanBlock("interval3", "Drill A-B-C");
  d.repeats = 6;
  d.step1Seconds = 60;
  d.step2Seconds = 45;
  d.step3Seconds = 30;
  d.intensity = "Z3";
  d.intensity2 = "Z2";
  d.intensity3 = "Z1";
  const c = defaultManualPlanBlock("steady", "Uscita tecnica");
  c.minutes = 12;
  c.intensity = "Z2";
  return [w, d, c];
}

function manualPresetTechnicalMixed(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Tecnico continuo");
  a.minutes = 45;
  a.intensity = "Z3";
  const b = defaultManualPlanBlock("interval2", "Accelerazioni brevi");
  b.repeats = 5;
  b.workSeconds = 45;
  b.recoverSeconds = 90;
  b.intensity = "Z4";
  b.intensity2 = "Z2";
  return [a, b];
}

function manualPresetTechnicalGame(): ManualPlanBlock[] {
  const w = defaultManualPlanBlock("steady", "Riscaldamento");
  w.minutes = 20;
  w.intensity = "Z2";
  const g = defaultManualPlanBlock("interval2", "Partita controllata");
  g.repeats = 6;
  g.workSeconds = 180;
  g.recoverSeconds = 120;
  g.intensity = "Z4";
  g.intensity2 = "Z2";
  return [w, g];
}

function manualPresetLifestyleGentle(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Centratura");
  a.minutes = 10;
  a.intensity = "Z1";
  const b = defaultManualPlanBlock("steady", "Corpo principale");
  b.minutes = 25;
  b.intensity = "Z2";
  const c = defaultManualPlanBlock("steady", "Chiusura / rilascio");
  c.minutes = 10;
  c.intensity = "Z1";
  return [a, b, c];
}

function manualPresetLifestyleMobility(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Mobilità globale");
  a.minutes = 20;
  a.intensity = "Z1";
  const b = defaultManualPlanBlock("interval2", "Mobilità dinamica");
  b.repeats = 8;
  b.workSeconds = 45;
  b.recoverSeconds = 30;
  b.intensity = "Z2";
  b.intensity2 = "Z1";
  const c = defaultManualPlanBlock("steady", "Rilascio finale");
  c.minutes = 15;
  c.intensity = "Z1";
  return [a, b, c];
}

function manualPresetLifestyleBreath(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Respiro & consapevolezza");
  a.minutes = 35;
  a.intensity = "Z1";
  const b = defaultManualPlanBlock("steady", "Movimento leggero");
  b.minutes = 15;
  b.intensity = "Z2";
  return [a, b];
}

const btnPrimary =
  "empathy-btn-gradient inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:brightness-110 disabled:opacity-40";

const btnIcon =
  "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-inner transition hover:bg-white/20 disabled:opacity-30";

const stepperBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-lg font-bold text-white shadow-inner transition hover:bg-white/10";

/** Controllo compatto tipo “RPM/SPM”: cella colorata + − / numero / + (stesso schema generativo). */
function GenerativeStepperPod({
  icon: Icon,
  label,
  value,
  onChange,
  min,
  max,
  step,
  borderClass,
  bgClass,
  iconClass,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
  /** Updater FUNZIONALE (riceve il valore precedente reale): i click rapidi non
   *  perdono step come farebbe un calcolo dallo snapshot di render. Vedi B2. */
  onChange: (update: (prev: number) => number) => void;
  min: number;
  max: number;
  step: number;
  borderClass: string;
  bgClass: string;
  iconClass: string;
}) {
  const t = useTranslations("BuilderManualComposer");
  const dec = () => onChange((prev) => Math.max(min, prev - step));
  const inc = () => onChange((prev) => Math.min(max, prev + step));
  return (
    <div className={`flex min-w-[9.5rem] flex-1 items-stretch gap-2 rounded-xl border p-2.5 shadow-inner ${borderClass} ${bgClass}`}>
      <div className="flex flex-col justify-center pt-4">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6rem] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <div className="mt-1 flex items-center gap-1">
          <button type="button" className={stepperBtn} onClick={dec} aria-label={t("decreaseAria", { label })}>
            −
          </button>
          <input
            type="number"
            className="h-9 w-full min-w-0 rounded-lg border border-white/15 bg-black/60 px-1 text-center font-mono text-sm text-white"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(() => Math.min(max, Math.max(min, n)));
            }}
          />
          <button type="button" className={stepperBtn} onClick={inc} aria-label={t("increaseAria", { label })}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export type BuilderManualComposerProps = {
  athleteId: string | null;
  physioHint: string | null;
  manualPlanBlocks: ManualPlanBlock[];
  setManualPlanBlocks: React.Dispatch<React.SetStateAction<ManualPlanBlock[]>>;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  intensityUnit: Pro2IntensityUnit;
  setIntensityUnit: React.Dispatch<React.SetStateAction<Pro2IntensityUnit>>;
  ftpW: number;
  setFtpW: React.Dispatch<React.SetStateAction<number>>;
  hrMax: number;
  setHrMax: React.Dispatch<React.SetStateAction<number>>;
  lengthMode: "time" | "distance";
  setLengthMode: React.Dispatch<React.SetStateAction<"time" | "distance">>;
  speedRefKmh: number;
  setSpeedRefKmh: React.Dispatch<React.SetStateAction<number>>;
  manualSessionName: string;
  setManualSessionName: React.Dispatch<React.SetStateAction<string>>;
  manualChartSegments: ChartSegment[];
  manualPlannedDate: string;
  setManualPlannedDate: React.Dispatch<React.SetStateAction<string>>;
  manualSaveBusy: boolean;
  onSaveManual: (targetDate: string) => void;
  manualSaveErr: string | null;
  manualSaveOkId: string | null;
  canSave: boolean;
  /** TSS stimato dal piano manuale (segmenti espansi). */
  estimatedTss: number;
  /** Macro A–D: skin e copy del composer (allineato a TrainingBuilderRichPageView). */
  macroFamily: SportMacroId;
  /** Durata seduta (calendario) scelta dal coach — non ricavata automaticamente dai blocchi. */
  manualSessionDurationMinutes: number;
  setManualSessionDurationMinutes: React.Dispatch<React.SetStateAction<number>>;
  /** Quando true, nasconde la barra di salvataggio interna (date + Salva + messaggi). */
  hideSaveBar?: boolean;
};

/**
 * Chip-blocco riordinabile con dnd-kit (drag affidabile dalla maniglia, click seleziona).
 * Sostituisce il drag HTML nativo che si rompeva. Prossimo step: fondere i chip nelle barre.
 */
function SortableBlockChip({
  block,
  index,
  active,
  canDelete,
  onSelect,
  onDelete,
  deleteLabel,
  dragLabel,
}: {
  block: ManualPlanBlock;
  index: number;
  active: boolean;
  canDelete: boolean;
  onSelect: (i: number) => void;
  onDelete: (i: number) => void;
  deleteLabel: string;
  dragLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined };
  const summary =
    block.kind === "interval2" || block.kind === "interval3"
      ? `${block.repeats}×`
      : block.kind === "pyramid"
        ? `${block.pyramidSteps}▲`
        : `${block.minutes + Math.round(block.seconds / 60)}′`;
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(index)}
      className={`group flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition ${
        active
          ? "border-orange-400/70 bg-orange-500/15 text-white"
          : "border-white/10 bg-black/30 text-gray-300 hover:border-white/25"
      } ${isDragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab touch-none rounded p-0.5 text-gray-500 hover:text-gray-300 active:cursor-grabbing"
        aria-label={dragLabel}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>
      <span className="font-mono text-[0.6rem] text-gray-500">{index + 1}</span>
      <span className="max-w-[8rem] truncate font-semibold">{block.label || `Blocco ${index + 1}`}</span>
      <span className="shrink-0 rounded bg-white/10 px-1 py-0.5 font-mono text-[0.55rem] text-gray-400">{summary}</span>
      {canDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(index);
          }}
          className="ml-0.5 rounded p-0.5 text-gray-500 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
          aria-label={deleteLabel}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

export function BuilderManualComposer({
  athleteId,
  physioHint,
  manualPlanBlocks,
  setManualPlanBlocks,
  activeIndex,
  setActiveIndex,
  intensityUnit,
  setIntensityUnit,
  ftpW,
  setFtpW,
  hrMax,
  setHrMax,
  lengthMode,
  setLengthMode,
  speedRefKmh,
  setSpeedRefKmh,
  manualSessionName,
  setManualSessionName,
  manualChartSegments,
  manualPlannedDate,
  setManualPlannedDate,
  manualSaveBusy,
  onSaveManual,
  manualSaveErr,
  manualSaveOkId,
  canSave,
  estimatedTss,
  macroFamily,
  manualSessionDurationMinutes,
  setManualSessionDurationMinutes,
  hideSaveBar,
}: BuilderManualComposerProps) {
  const t = useTranslations("BuilderManualComposer");
  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, manualPlanBlocks.length - 1));
  const row = manualPlanBlocks[safeIndex];
  const kindMetaList = kindMetaForFamily(macroFamily);

  const structureMinutesFromChart = useMemo(
    () => Math.max(0, Math.round(manualChartSegments.reduce((s, seg) => s + seg.durationSeconds, 0) / 60)),
    [manualChartSegments],
  );

  useEffect(() => {
    const allowed = new Set(kindMetaForFamily(macroFamily).map((k) => k.kind));
    setManualPlanBlocks((blocks) => {
      let changed = false;
      const next = blocks.map((b) => {
        if (allowed.has(b.kind)) return b;
        changed = true;
        return {
          ...defaultManualPlanBlock("steady", b.label),
          id: b.id,
          label: b.label,
          notes: b.notes,
          cadenceMetric: b.cadenceMetric,
          cadenceMin: b.cadenceMin,
          cadenceMax: b.cadenceMax,
          frequencyHint: b.frequencyHint,
          target: b.target,
        };
      });
      return changed ? next : blocks;
    });
  }, [macroFamily, setManualPlanBlocks]);

  const patch = (partial: Partial<ManualPlanBlock>) => {
    setManualPlanBlocks((p) => p.map((b, i) => (i === safeIndex ? { ...b, ...partial } : b)));
  };

  /**
   * Patch FUNZIONALE: calcola il nuovo valore dallo stato PRECEDENTE, non dallo
   * snapshot di render. Serve agli stepper «−/+»: con `patch({ minutes: row.minutes - 1 })`
   * due click rapidi (prima del re-render) partivano dallo stesso `row.minutes` e il
   * secondo era un no-op («a volte il − non funziona», B2). Qui ogni click parte dal
   * valore corrente reale.
   */
  const patchFn = (compute: (b: ManualPlanBlock) => Partial<ManualPlanBlock>) => {
    setManualPlanBlocks((p) => p.map((b, i) => (i === safeIndex ? { ...b, ...compute(b) } : b)));
  };

  /** «−» durata: sottrae `deltaSec` prendendo in prestito dai minuti (i secondi a 0
   *  non restano bloccati — B2: il − sul riscaldamento a minuti interi «non faceva niente»). */
  const stepDurationSeconds = (deltaSec: number) =>
    patchFn((b) => {
      const total = Math.max(0, b.minutes * 60 + b.seconds + deltaSec);
      return { minutes: Math.floor(total / 60), seconds: total % 60 };
    });

  const setKind = (k: PlanBlockKind) => {
    setManualPlanBlocks((p) =>
      p.map((b, i) =>
        i === safeIndex
          ? {
              ...defaultManualPlanBlock(k, b.label),
              id: b.id,
              label: b.label,
              notes: b.notes,
              cadenceMetric: b.cadenceMetric,
              cadenceMin: b.cadenceMin,
              cadenceMax: b.cadenceMax,
              frequencyHint: b.frequencyHint,
              target: b.target,
            }
          : b,
      ),
    );
  };

  const addBlock = () => {
    setManualPlanBlocks((p) => {
      const next = [...p, defaultManualPlanBlock("steady", `Blocco ${p.length + 1}`)];
      const idx = next.length - 1;
      queueMicrotask(() => setActiveIndex(idx));
      return next;
    });
  };

  const removeBlock = () => {
    if (manualPlanBlocks.length <= 1) return;
    const nextLen = manualPlanBlocks.length - 1;
    const nextIdx = Math.min(safeIndex, nextLen - 1);
    setManualPlanBlocks((p) => p.filter((_, i) => i !== safeIndex));
    setActiveIndex(Math.max(0, nextIdx));
  };

  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(manualPlanBlocks.length - 1, i + 1));

  // [G1] Comandi grafici: lista blocchi con drag-per-riordinare + click-per-selezionare
  // + «+» per inserire in posizione. Il pannello editor sotto resta l'unico form (fonte
  // di verità), che «appare» sul blocco selezionato — nessun rewrite del maxi-editor.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveBlock = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setManualPlanBlocks((p) => {
      if (from >= p.length || to >= p.length) return p;
      const next = [...p];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
    setActiveIndex(to);
  };

  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = manualPlanBlocks.findIndex((b) => b.id === active.id);
    const to = manualPlanBlocks.findIndex((b) => b.id === over.id);
    moveBlock(from, to);
  };

  const insertBlockAfter = (index: number) => {
    setManualPlanBlocks((p) => {
      const next = [...p];
      next.splice(index + 1, 0, defaultManualPlanBlock("steady", `Blocco ${p.length + 1}`));
      return next;
    });
    queueMicrotask(() => setActiveIndex(index + 1));
  };

  const removeBlockAt = (index: number) => {
    if (manualPlanBlocks.length <= 1) return;
    setManualPlanBlocks((p) => p.filter((_, i) => i !== index));
    setActiveIndex((i) => Math.max(0, Math.min(i > index ? i - 1 : i, manualPlanBlocks.length - 2)));
  };

  if (!row) {
    return null;
  }

  const ftp = Math.max(1, ftpW);
  const hr = Math.max(1, hrMax);

  const skin =
    macroFamily === "technical"
      ? { border: "border-orange-500/25", bg: "from-orange-950/[0.18] via-black/60 to-black/80" }
      : macroFamily === "lifestyle"
        ? { border: "border-orange-500/25", bg: "from-orange-950/[0.18] via-black/60 to-black/80" }
        : { border: "border-orange-500/25", bg: "from-orange-950/[0.18] via-black/60 to-black/80" };

  const titleCopy =
    macroFamily === "technical"
      ? { h: t("titleTechnicalH"), p: t("titleTechnicalP") }
      : macroFamily === "lifestyle"
        ? {
            h: t("titleLifestyleH"),
            p: t("titleLifestyleP"),
          }
        : {
            h: t("titleAerobicH"),
            p: t("titleAerobicP"),
          };

  const showAerobicDistance = macroFamily === "aerobic";
  const showCadenceRow = macroFamily === "aerobic";

  return (
    <section
      aria-label={t("sectionAria")}
      className={`rounded-2xl border bg-gradient-to-b ${skin.border} ${skin.bg} p-4 sm:p-6`}
    >
      {/* [G1] Valori preimpostati per i campi durata degli intervalli (tendina + inserimento libero). */}
      <datalist id="builder-sec-presets">
        {[15, 20, 30, 40, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-lg font-bold text-white"
          >
            {titleCopy.h}
          </h2>
          <p className="mt-1 max-w-xl text-xs text-gray-400">{titleCopy.p}</p>
        </div>
        {physioHint ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-medium text-emerald-200">
            {physioHint}
          </span>
        ) : null}
      </div>

      {/* Grafico in alto */}
      <div
        className="mt-4 rounded-2xl border border-orange-500/25 bg-black/50 p-3 shadow-inner"
      >
        <SessionBlockIntensityChart segments={manualChartSegments} title={t("sessionPreview")} estimatedTss={estimatedTss} />
        {/* [G1] Lista blocchi: trascina la maniglia per riordinare (dnd-kit), clicca per aprire l'editor sotto. */}
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
          <SortableContext items={manualPlanBlocks.map((b) => b.id)} strategy={horizontalListSortingStrategy}>
            <div className="mt-3 flex flex-wrap items-stretch gap-1.5">
              {manualPlanBlocks.map((b, i) => (
                <SortableBlockChip
                  key={b.id}
                  block={b}
                  index={i}
                  active={i === safeIndex}
                  canDelete={manualPlanBlocks.length > 1}
                  onSelect={setActiveIndex}
                  onDelete={removeBlockAt}
                  deleteLabel={t("deleteBlockAria")}
                  dragLabel={t("dragToReorder")}
                />
              ))}
              <button
                type="button"
                onClick={() => insertBlockAfter(safeIndex)}
                className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
                aria-label={t("addBlockAria")}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addBlockShort")}
              </button>
            </div>
          </SortableContext>
        </DndContext>
        <p className="mt-1.5 text-center text-[0.6rem] text-gray-600">{t("dragHint")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
            <span className="font-mono uppercase tracking-[0.2em] text-gray-500">{t("durationInCalendar")}</span>
            <select
              className="min-w-[7.5rem] rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm font-mono text-white"
              value={manualSessionDurationMinutes}
              onChange={(e) => setManualSessionDurationMinutes(Number(e.target.value))}
            >
              {SESSION_DURATION_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <p className="max-w-md pb-1 text-[0.65rem] leading-relaxed text-gray-500">
            {t.rich("segmentsSum", {
              minutes: structureMinutesFromChart,
              b: (chunks) => <span className="font-mono font-semibold text-gray-300">{chunks}</span>,
            })}
          </p>
        </div>
      </div>

      {macroFamily === "technical" ? (
        <div className="mt-4 rounded-xl border border-orange-500/25 bg-orange-500/[0.08] p-3">
          <p className="mb-2 flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("quickSessionsTechnical")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-600/80 to-amber-700/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetTechnicalDrills());
                setActiveIndex(0);
              }}
            >
              Drill A-B-C
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-600/80 to-amber-700/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetTechnicalMixed());
                setActiveIndex(0);
              }}
            >
              {t("presetTechnicalBurst")}
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-600/80 to-amber-700/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetTechnicalGame());
                setActiveIndex(0);
              }}
            >
              {t("presetGame")}
            </button>
          </div>
        </div>
      ) : macroFamily === "lifestyle" ? (
        <div className="mt-4 rounded-xl border border-orange-500/25 bg-orange-500/[0.08] p-3">
          <p className="mb-2 flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("quickSessionsLifestyle")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-600/80 to-amber-700/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetLifestyleGentle());
                setActiveIndex(0);
              }}
            >
              {t("presetGentleFlow")}
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-600/80 to-amber-700/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetLifestyleMobility());
                setActiveIndex(0);
              }}
            >
              {t("presetMobility")}
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-orange-400/35 bg-gradient-to-br from-orange-600/80 to-amber-700/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetLifestyleBreath());
                setActiveIndex(0);
              }}
            >
              {t("presetBreathMovement")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/35 p-3">
          <div className="flex rounded-full border border-white/15 bg-black/50 p-0.5">
            <button
              type="button"
              onClick={() => setIntensityUnit("watt")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                intensityUnit === "watt" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black" : "text-gray-400"
              }`}
            >
              <Zap
                className={`h-3.5 w-3.5 ${intensityUnit === "watt" ? "text-amber-950 drop-shadow-sm" : "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]"}`}
                aria-hidden
              />
              W
            </button>
            <button
              type="button"
              onClick={() => setIntensityUnit("hr")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                intensityUnit === "hr" ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white" : "text-gray-400"
              }`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${intensityUnit === "hr" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]" : "text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.45)]"}`}
                aria-hidden
              />
              HR
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-14 shrink-0">FTP</span>
            <input
              type="number"
              min={50}
              max={600}
              className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white"
              value={ftpW}
              onChange={(e) => setFtpW(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-14 shrink-0">{t("hrMax")}</span>
            <input
              type="number"
              min={120}
              max={220}
              className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white"
              value={hrMax}
              onChange={(e) => setHrMax(Number(e.target.value))}
            />
          </label>
          <label className="ml-auto flex min-w-[8rem] flex-1 flex-col gap-1 text-[0.65rem] text-gray-500 sm:max-w-xs">
            {t("sessionName")}
            <input
              type="text"
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={manualSessionName}
              onChange={(e) => setManualSessionName(e.target.value)}
            />
          </label>
        </div>

      {showAerobicDistance ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] text-gray-500">
          <span>
            {t("durationLabel")}{" "}
            <button
              type="button"
              className={lengthMode === "time" ? "text-orange-300 underline" : ""}
              onClick={() => setLengthMode("time")}
            >
              {t("durationTime")}
            </button>
            {" · "}
            <button
              type="button"
              className={lengthMode === "distance" ? "text-orange-300 underline" : ""}
              onClick={() => setLengthMode("distance")}
            >
              {t("durationDistance")}
            </button>
          </span>
          <span className="text-gray-600">|</span>
          <label className="flex items-center gap-1">
            {t("refSpeedKmh")}
            <input
              type="number"
              min={5}
              max={60}
              className="w-14 rounded border border-white/15 bg-black/40 px-1 py-0.5 text-gray-200"
              value={speedRefKmh}
              onChange={(e) => setSpeedRefKmh(Number(e.target.value))}
            />
          </label>
        </div>
      ) : (
        <p className="mt-2 text-[0.65rem] text-gray-600">
          {t("blocksOnTimeNote")}
        </p>
      )}

      {/* Navigazione blocchi */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className={btnIcon} onClick={goPrev} disabled={safeIndex <= 0} aria-label={t("previousBlockAria")}>
            <ChevronLeft className="h-5 w-5 text-orange-400" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-mono text-gray-300">
            {t("blockCounter", { current: safeIndex + 1, total: manualPlanBlocks.length })}
          </span>
          <button
            type="button"
            className={btnIcon}
            onClick={goNext}
            disabled={safeIndex >= manualPlanBlocks.length - 1}
            aria-label={t("nextBlockAria")}
          >
            <ChevronRight className="h-5 w-5 text-orange-400" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={`${btnIcon} border-emerald-500/40 bg-emerald-500/20`} onClick={addBlock} aria-label={t("addBlockAria")}>
            <Plus className="h-5 w-5 text-emerald-200" />
          </button>
          <button
            type="button"
            className={`${btnIcon} border-rose-500/40 bg-rose-500/15`}
            onClick={removeBlock}
            disabled={manualPlanBlocks.length <= 1}
            aria-label={t("deleteBlockAria")}
          >
            <Trash2 className="h-5 w-5 text-rose-200" />
          </button>
        </div>
      </div>

      {/* Un solo pannello blocco */}
      <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4">
        <input
          type="text"
          className="mb-3 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base font-semibold text-white"
          value={row.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={t("blockNamePlaceholder")}
        />

        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">{t("typeLabel")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {kindMetaList.map(({ kind, label, icon: Icon, color, iconClass }) => {
            const on = row.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setKind(kind)}
                className={`flex flex-1 min-w-[5.5rem] flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-[0.7rem] font-bold transition sm:min-w-[6rem] ${
                  on ? "border-white text-white shadow-lg scale-[1.02]" : "border-white/10 text-gray-300 opacity-80 hover:opacity-100"
                } bg-gradient-to-br ${color}`}
              >
                <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {(row.kind === "steady" || row.kind === "ramp") && lengthMode === "time" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-2 py-2">
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1 text-lg" onClick={() => stepDurationSeconds(-60)}>
                  −
                </button>
                <div className="text-center">
                  <p className="text-[0.6rem] text-gray-500">Min</p>
                  <p className="font-mono text-xl text-white">{row.minutes}</p>
                </div>
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1 text-lg" onClick={() => stepDurationSeconds(60)}>
                  +
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-2 py-2">
                <button
                  type="button"
                  className="rounded-lg bg-white/10 px-2 py-1 text-lg"
                  onClick={() => stepDurationSeconds(-5)}
                >
                  −
                </button>
                <div className="text-center">
                  <p className="text-[0.6rem] text-gray-500">Sec</p>
                  <p className="font-mono text-xl text-white">{row.seconds}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-white/10 px-2 py-1 text-lg"
                  onClick={() => stepDurationSeconds(5)}
                >
                  +
                </button>
              </div>
            </div>
          ) : null}

          {(row.kind === "steady" || row.kind === "ramp" || row.kind === "pyramid") && showAerobicDistance && lengthMode === "distance" ? (
            <label className="flex max-w-xs flex-col gap-1 text-xs text-gray-500">
              {t("distanceKm")}
              <input
                type="number"
                step="0.1"
                min={0.1}
                className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-white"
                value={row.distanceKm}
                onChange={(e) => patch({ distanceKm: Number(e.target.value) })}
              />
            </label>
          ) : null}

          {row.kind === "steady" ? (
            <ZoneStrip
              label={t("mainZone")}
              value={row.intensity}
              onPick={(z) => patch({ intensity: z })}
              unit={intensityUnit}
              ftpW={ftp}
              hrMax={hr}
            />
          ) : null}

          {row.kind === "ramp" ? (
            <div className="space-y-3">
              <ZoneStrip
                label={t("startZone")}
                value={row.startIntensity}
                onPick={(z) => patch({ startIntensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label={t("endZone")}
                value={row.endIntensity}
                onPick={(z) => patch({ endIntensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
            </div>
          ) : null}

          {row.kind === "interval2" ? (
            <div className="space-y-3">
              <ZoneStrip
                label={t("workZone")}
                value={row.intensity}
                onPick={(z) => patch({ intensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label={t("recoveryZone")}
                value={row.intensity2}
                onPick={(z) => patch({ intensity2: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-gray-500">
                  {t("repeats")}
                  <input
                    type="number"
                    min={1}
                    className="ml-2 w-16 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white"
                    value={row.repeats}
                    onChange={(e) => patch({ repeats: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Work (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-16 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white"
                    list="builder-sec-presets"
                    value={row.workSeconds}
                    onChange={(e) => patch({ workSeconds: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Rec (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-16 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white"
                    list="builder-sec-presets"
                    value={row.recoverSeconds}
                    onChange={(e) => patch({ recoverSeconds: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {row.kind === "interval3" ? (
            <div className="space-y-3">
              <ZoneStrip
                label={t("phaseA")}
                value={row.intensity}
                onPick={(z) => patch({ intensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label={t("phaseB")}
                value={row.intensity2}
                onPick={(z) => patch({ intensity2: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label={t("phaseC")}
                value={row.intensity3}
                onPick={(z) => patch({ intensity3: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <label>
                  {t("sets")}
                  <input
                    type="number"
                    min={1}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    value={row.repeats}
                    onChange={(e) => patch({ repeats: Number(e.target.value) })}
                  />
                </label>
                <label>
                  A (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    list="builder-sec-presets"
                    value={row.step1Seconds}
                    onChange={(e) => patch({ step1Seconds: Number(e.target.value) })}
                  />
                </label>
                <label>
                  B (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    list="builder-sec-presets"
                    value={row.step2Seconds}
                    onChange={(e) => patch({ step2Seconds: Number(e.target.value) })}
                  />
                </label>
                <label>
                  C (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    list="builder-sec-presets"
                    value={row.step3Seconds}
                    onChange={(e) => patch({ step3Seconds: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {row.kind === "pyramid" ? (
            <div className="space-y-2">
              <p className="flex flex-col gap-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 sm:flex-row sm:items-center sm:gap-2">
                <span className="inline-flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-orange-300" aria-hidden />
                  {t("pyramid")}
                </span>
                <span className="font-mono text-[0.58rem] font-normal normal-case text-gray-600">
                  {t("pyramidFormula")}
                </span>
              </p>
              <div className="flex flex-wrap gap-3">
                <GenerativeStepperPod
                  icon={Layers}
                  label={t("steps")}
                  value={row.pyramidSteps}
                  onChange={(upd) => patchFn((b) => ({ pyramidSteps: upd(b.pyramidSteps) }))}
                  min={1}
                  max={30}
                  step={1}
                  borderClass="border-orange-500/40"
                  bgClass="bg-orange-500/10"
                  iconClass="text-orange-300"
                />
                <GenerativeStepperPod
                  icon={Timer}
                  label={t("secPerStep")}
                  value={row.pyramidStepSeconds}
                  onChange={(upd) => patchFn((b) => ({ pyramidStepSeconds: upd(b.pyramidStepSeconds) }))}
                  min={20}
                  max={900}
                  step={10}
                  borderClass="border-orange-500/40"
                  bgClass="bg-orange-500/10"
                  iconClass="text-orange-300"
                />
                <GenerativeStepperPod
                  icon={intensityUnit === "watt" ? Zap : Heart}
                  label={`Start (${intensityUnit === "watt" ? "W" : "bpm"})`}
                  value={row.pyramidStartTarget}
                  onChange={(upd) => patchFn((b) => ({ pyramidStartTarget: upd(b.pyramidStartTarget) }))}
                  min={intensityUnit === "watt" ? 50 : 90}
                  max={intensityUnit === "watt" ? 600 : 220}
                  step={intensityUnit === "watt" ? 5 : 1}
                  borderClass="border-orange-500/40"
                  bgClass="bg-orange-500/10"
                  iconClass="text-orange-300"
                />
                <GenerativeStepperPod
                  icon={TrendingUp}
                  label={`End (${intensityUnit === "watt" ? "W" : "bpm"})`}
                  value={row.pyramidEndTarget}
                  onChange={(upd) => patchFn((b) => ({ pyramidEndTarget: upd(b.pyramidEndTarget) }))}
                  min={intensityUnit === "watt" ? 50 : 90}
                  max={intensityUnit === "watt" ? 600 : 220}
                  step={intensityUnit === "watt" ? 5 : 1}
                  borderClass="border-orange-500/40"
                  bgClass="bg-orange-500/10"
                  iconClass="text-orange-300"
                />
              </div>
            </div>
          ) : null}

          <div className={`flex flex-wrap items-end gap-3 ${!showCadenceRow ? "hidden" : ""}`}>
            <div className="space-y-1.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">{t("cadence")}</p>
              <div className="flex rounded-full border border-white/15 bg-black/50 p-0.5">
                <button
                  type="button"
                  onClick={() => patch({ cadenceMetric: "none" })}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    row.cadenceMetric === "none" ? "bg-white/15 text-white" : "text-gray-500"
                  }`}
                >
                  —
                </button>
                <button
                  type="button"
                  onClick={() => patch({ cadenceMetric: "rpm" })}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                    row.cadenceMetric === "rpm"
                      ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-black"
                      : "text-gray-400"
                  }`}
                >
                  <Gauge
                    className={`h-3.5 w-3.5 ${row.cadenceMetric === "rpm" ? "text-teal-950" : "text-teal-400 drop-shadow-[0_0_6px_rgba(45,212,191,0.4)]"}`}
                    aria-hidden
                  />
                  RPM
                </button>
                <button
                  type="button"
                  onClick={() => patch({ cadenceMetric: "spm" })}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                    row.cadenceMetric === "spm"
                      ? "bg-gradient-to-r from-lime-500 to-emerald-500 text-black"
                      : "text-gray-400"
                  }`}
                >
                  <Footprints
                    className={`h-3.5 w-3.5 ${row.cadenceMetric === "spm" ? "text-lime-950" : "text-lime-400 drop-shadow-[0_0_6px_rgba(163,230,53,0.4)]"}`}
                    aria-hidden
                  />
                  SPM
                </button>
              </div>
            </div>
            <label className={`flex items-center gap-2 text-xs text-gray-400 ${row.cadenceMetric === "none" ? "opacity-40" : ""}`}>
              <span className="w-10 shrink-0">Min</span>
              <input
                type="number"
                min={30}
                max={220}
                disabled={row.cadenceMetric === "none"}
                className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white disabled:cursor-not-allowed"
                value={row.cadenceMin}
                onChange={(e) => patch({ cadenceMin: Number(e.target.value) })}
              />
            </label>
            <label className={`flex items-center gap-2 text-xs text-gray-400 ${row.cadenceMetric === "none" ? "opacity-40" : ""}`}>
              <span className="w-10 shrink-0">Max</span>
              <input
                type="number"
                min={30}
                max={240}
                disabled={row.cadenceMetric === "none"}
                className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white disabled:cursor-not-allowed"
                value={row.cadenceMax}
                onChange={(e) => patch({ cadenceMax: Number(e.target.value) })}
              />
            </label>
          </div>
          {macroFamily === "technical" ? (
            <details className="mt-3 rounded-lg border border-white/10 bg-black/25">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-400">
                {t("notesAndLoadSummary")}
              </summary>
              <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-3">
                <label className="flex flex-col gap-1 text-xs text-gray-500">
                  {t("executionNotes")}
                  <textarea
                    rows={2}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={row.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </label>
                <label className="flex max-w-xs flex-col gap-1 text-xs text-gray-500">
                  {t("loadMultiplier")}
                  <input
                    type="number"
                    step="0.05"
                    min={0.3}
                    max={2}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-white"
                    value={row.loadFactor}
                    onChange={(e) => patch({ loadFactor: Number(e.target.value) })}
                  />
                </label>
              </div>
            </details>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-gray-500">
                {t("executionNotes")}
                <textarea
                  rows={2}
                  className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                  value={row.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
              <label className="flex max-w-xs flex-col gap-1 text-xs text-gray-500">
                {t("loadMultiplier")}
                <input
                  type="number"
                  step="0.05"
                  min={0.3}
                  max={2}
                  className="rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-white"
                  value={row.loadFactor}
                  onChange={(e) => patch({ loadFactor: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {!hideSaveBar && (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              {t("date")}
              <input
                type="date"
                className="rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                value={manualPlannedDate}
                onChange={(e) => setManualPlannedDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={!athleteId || !canSave || manualSaveBusy}
              onClick={() => onSaveManual(manualPlannedDate)}
            >
              {manualSaveBusy ? t("saving") : t("saveToCalendar")}
            </button>
          </div>
          {manualSaveErr ? (
            <p className="mt-3 text-sm text-amber-300" role="alert">
              {manualSaveErr}
            </p>
          ) : null}
          {manualSaveOkId ? (
            <BuilderCalendarSaveConfirm date={manualPlannedDate} plannedWorkoutId={manualSaveOkId} />
          ) : null}
        </>
      )}
    </section>
  );
}
