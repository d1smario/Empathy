"use client";

import { GripVertical, X } from "lucide-react";
import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { colorForIntensity, intensityScore } from "@/lib/training/builder/pro2-intensity";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import type { ManualPlanBlock, PlanBlockKind } from "@/lib/training/builder/manual-plan-block";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";

/** Altezza dell'area-tela (px): le barre crescono da qui verso l'alto. */
const CANVAS_HEIGHT = 130;

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  if (s === 0) return `${m}′`;
  return `${m}′${s.toString().padStart(2, "0")}″`;
}

/** Nome «forma» del tipo, fallback per il label del blocco. */
const KIND_SHAPE_LABEL: Record<PlanBlockKind, string> = {
  steady: "steady",
  ramp: "ramp",
  interval2: "intervalli",
  interval3: "3 fasi",
  pyramid: "piramide",
};

/** Altezza barra in % dell'area (score 0.35–7 → 22–100%). */
function heightPct(score: number): number {
  return Math.max(22, (Math.max(0.35, score) / 7) * 100);
}

type BlockGroup = {
  block: ManualPlanBlock;
  index: number;
  segments: ChartSegment[];
  totalSeconds: number;
};

/**
 * Forma del blocco disegnata a piena altezza dell'area-tela.
 * - steady → rettangolo pieno (una zona);
 * - ramp → trapezio in salita da startIntensity a endIntensity (clip-path);
 * - interval2 / interval3 / pyramid → sotto-barre a denti di sega / scala (segmenti espansi).
 */
function BlockShape({ group }: { group: BlockGroup }) {
  const { block, segments } = group;

  if (block.kind === "ramp") {
    const startPct = heightPct(intensityScore(block.startIntensity));
    const endPct = heightPct(intensityScore(block.endIntensity));
    const color = colorForIntensity(block.endIntensity);
    return (
      <div className="relative h-full w-full">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 12px ${color}44`,
            clipPath: `polygon(0% ${100 - startPct}%, 100% ${100 - endPct}%, 100% 100%, 0% 100%)`,
          }}
        />
      </div>
    );
  }

  if (block.kind === "steady" || segments.length <= 1) {
    const seg = segments[0];
    const label = seg?.intensityLabel ?? block.intensity;
    const score = seg ? (seg.barIntensityScore ?? seg.intensityScore) : intensityScore(block.intensity);
    const color = colorForIntensity(label);
    return (
      <div className="flex h-full w-full items-end">
        <div
          className="w-full rounded-t-[2px]"
          style={{ height: `${heightPct(score)}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}44` }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-end gap-[1px]">
      {segments.map((seg) => {
        const score = seg.barIntensityScore ?? seg.intensityScore;
        const color = colorForIntensity(seg.intensityLabel);
        return (
          <div
            key={seg.id}
            className="min-w-0 rounded-t-[1px]"
            style={{
              flexGrow: Math.max(1, seg.durationSeconds),
              flexBasis: 0,
              height: `${heightPct(score)}%`,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}44`,
            }}
          />
        );
      })}
    </div>
  );
}

function zoneLabelFor(block: ManualPlanBlock): string {
  if (block.kind === "ramp") return `${block.startIntensity}→${block.endIntensity}`;
  if (block.kind === "interval2" || block.kind === "interval3") return `${block.repeats}× ${block.intensity}`;
  return block.intensity;
}

/**
 * UNA barra = UN blocco. flexGrow ∝ durata (blocco lungo → barra larga). Cliccabile
 * per selezionare, maniglia drag per riordinare, x per eliminare. Attiva = ring bianco.
 */
function SortableBlockBar({
  group,
  active,
  canDelete,
  onSelect,
  onDelete,
}: {
  group: BlockGroup;
  active: boolean;
  canDelete: boolean;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const t = useTranslations("BuilderManualComposer");
  const { block, index, totalSeconds } = group;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    flexGrow: Math.max(1, totalSeconds),
    flexBasis: 0,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(index)}
      className={`group relative flex min-w-[2.75rem] cursor-pointer flex-col ${isDragging ? "opacity-70" : ""}`}
    >
      {/* Etichetta sopra la barra: N · nome */}
      <div className="mb-1 truncate px-0.5 text-[0.62rem] font-semibold leading-tight text-white/90">
        <span className="mr-0.5 font-mono text-gray-500">{index + 1}</span>
        <span className={active ? "text-white" : "text-white/75"}>{block.label || KIND_SHAPE_LABEL[block.kind]}</span>
      </div>

      {/* Area-tela della barra: la forma cresce dal fondo. Attiva = ring bianco. */}
      <div
        className={`relative rounded-md transition ${
          active ? "ring-2 ring-white ring-offset-1 ring-offset-black" : "opacity-70 group-hover:opacity-100"
        }`}
        style={{ height: CANVAS_HEIGHT }}
      >
        <div className="flex h-full items-end">
          <BlockShape group={group} />
        </div>

        {active ? (
          <span className="pointer-events-none absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-wider text-black shadow">
            {t("canvasActiveMarker")}
          </span>
        ) : null}

        {/* Maniglia drag sull'angolo della barra */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-0 z-10 cursor-grab touch-none rounded-br-md bg-black/55 p-0.5 text-gray-400 opacity-0 transition hover:text-white group-hover:opacity-100 active:cursor-grabbing"
          aria-label={t("dragToReorder")}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>

        {/* Elimina sull'angolo opposto */}
        {canDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(index);
            }}
            className="absolute right-0 top-0 z-10 rounded-bl-md bg-black/55 p-0.5 text-gray-400 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
            aria-label={t("deleteBlockAria")}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {/* Sotto la barra: durata + zona */}
      <div className="mt-1 flex items-center justify-between gap-1 px-0.5 text-[0.55rem] leading-tight">
        <span className="truncate font-mono font-semibold text-white/80">{formatSec(totalSeconds)}</span>
        <span className="truncate font-bold" style={{ color: colorForIntensity(block.intensity) }}>
          {zoneLabelFor(block)}
        </span>
      </div>
    </div>
  );
}

/**
 * Tela interattiva del compositore: UNA sola riga di barre affiancate (un grafico
 * continuo partizionato), ogni barra = un blocco con larghezza ∝ durata e altezza ∝
 * intensità. Click = seleziona, drag = riordina. In coda, drop-zone tratteggiata.
 * LOCALE al composer: NON tocca SessionBlockIntensityChart condiviso.
 */
export function BuilderBlockCanvas({
  blocks,
  segments,
  activeIndex,
  onSelect,
  onRemove,
  sensors,
  onDragEnd,
  title,
  estimatedTss,
}: {
  blocks: ManualPlanBlock[];
  segments: ChartSegment[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent) => void;
  title: string;
  estimatedTss?: number;
}) {
  const t = useTranslations("BuilderManualComposer");
  const groups = useMemo<BlockGroup[]>(() => {
    const byBlock = new Map<string, ChartSegment[]>();
    for (const seg of segments) {
      if (!seg.blockId) continue;
      const arr = byBlock.get(seg.blockId);
      if (arr) arr.push(seg);
      else byBlock.set(seg.blockId, [seg]);
    }
    return blocks.map((block, index) => {
      const segs = byBlock.get(block.id) ?? [];
      const totalSeconds = segs.reduce((s, x) => s + x.durationSeconds, 0);
      return { block, index, segments: segs, totalSeconds };
    });
  }, [blocks, segments]);

  const totalSeconds = groups.reduce((s, g) => s + g.totalSeconds, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">{title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.65rem] text-gray-500">
          <span>{t("canvasTotalSummary", { total: formatSec(totalSeconds), count: blocks.length })}</span>
          {typeof estimatedTss === "number" ? (
            <span className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 font-semibold text-orange-300">
              {LOAD_CHIP_LABEL} ~{estimatedTss}
            </span>
          ) : null}
        </div>
      </div>

      {/* UNA sola area-tela scura: dentro, la riga di barre affiancate. */}
      <div className="rounded-xl border border-white/10 bg-black/60 p-3 shadow-inner">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-end gap-[3px]">
              {groups.map((group) => (
                <SortableBlockBar
                  key={group.block.id}
                  group={group}
                  active={group.index === activeIndex}
                  canDelete={blocks.length > 1}
                  onSelect={onSelect}
                  onDelete={onRemove}
                />
              ))}

              {/* Drop-zone in coda (placeholder visivo: drag-dalla-tavolozza non attivo). */}
              <div className="flex shrink-0 flex-col" style={{ flexGrow: 0.4, flexBasis: 0 }} aria-hidden>
                <div className="mb-1 h-[0.62rem]" />
                <div
                  className="flex items-center justify-center rounded-md border-2 border-dashed border-white/15 px-1 text-center text-[0.55rem] font-semibold uppercase leading-tight tracking-wider text-gray-600"
                  style={{ height: CANVAS_HEIGHT }}
                >
                  {t("canvasDropHere")}
                </div>
                <div className="mt-1 h-[0.55rem]" />
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Caption sotto la tela */}
      <p className="text-center text-[0.6rem] text-gray-500">{t("dragHint")}</p>
    </div>
  );
}
