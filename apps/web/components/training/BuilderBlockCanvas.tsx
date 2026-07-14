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

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  if (s === 0) return `${m}′`;
  return `${m}′${s.toString().padStart(2, "0")}″`;
}

/** Nome «forma» del tipo (piatta / salita / denti di sega / triangolo), per l'etichetta gruppo. */
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

function GroupBars({ group }: { group: BlockGroup }) {
  const { block, segments } = group;

  // Ramp: i segmenti espansi danno UNA barra sola (limite motore). Qui disegniamo
  // la salita reale start→end con un trapezio (clip-path) così la «forma» emerge.
  if (block.kind === "ramp") {
    const startPct = heightPct(intensityScore(block.startIntensity));
    const endPct = heightPct(intensityScore(block.endIntensity));
    const color = colorForIntensity(block.endIntensity);
    return (
      <div className="flex h-full items-end">
        <div className="relative mx-0.5 h-full w-full">
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-sm ring-1 ring-white/10"
            style={{
              height: "100%",
              backgroundColor: color,
              boxShadow: `0 0 12px ${color}44`,
              clipPath: `polygon(0% ${100 - startPct}%, 100% ${100 - endPct}%, 100% 100%, 0% 100%)`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-end gap-[2px]">
      {segments.map((seg) => {
        const score = seg.barIntensityScore ?? seg.intensityScore;
        const color = colorForIntensity(seg.intensityLabel);
        return (
          <div
            key={seg.id}
            className="min-w-0 rounded-t-sm ring-1 ring-white/10"
            style={{
              flexGrow: Math.max(1, seg.durationSeconds),
              flexBasis: 0,
              height: `${heightPct(score)}%`,
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}44`,
            }}
          />
        );
      })}
    </div>
  );
}

function SortableBlockGroup({
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
    zIndex: isDragging ? 30 : undefined,
  };
  const shape = KIND_SHAPE_LABEL[block.kind];
  const zoneLabel =
    block.kind === "ramp"
      ? `${block.startIntensity}→${block.endIntensity}`
      : block.kind === "interval2" || block.kind === "interval3"
        ? `${block.repeats}× ${block.intensity}`
        : block.intensity;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(index)}
      className={`group relative flex w-[8.5rem] shrink-0 cursor-pointer flex-col rounded-xl border p-2 transition ${
        active
          ? "border-white bg-white/[0.07] ring-2 ring-white/80"
          : "border-white/10 bg-black/40 hover:border-white/30"
      } ${isDragging ? "opacity-70 shadow-2xl" : ""}`}
    >
      {active ? (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-wider text-black shadow">
          {t("canvasActiveMarker")}
        </span>
      ) : null}

      {/* Testata gruppo: maniglia drag + numero·nome + elimina */}
      <div className="mb-1.5 flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab touch-none rounded p-0.5 text-gray-500 hover:text-gray-200 active:cursor-grabbing"
          aria-label={t("dragToReorder")}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-[0.68rem] font-bold text-white">
          <span className="mr-1 font-mono text-gray-500">{index + 1}</span>
          {block.label || shape}
        </span>
        {canDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(index);
            }}
            className="rounded p-0.5 text-gray-500 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
            aria-label={t("deleteBlockAria")}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {/* Forma del blocco (le barre = i segmenti espansi) */}
      <div className="h-16 rounded-lg border border-white/5 bg-black/50 p-1 shadow-inner">
        <GroupBars group={group} />
      </div>

      {/* Durata / zona */}
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[0.58rem] leading-tight">
        <span className="truncate font-mono font-semibold text-white/90">{formatSec(totalSeconds)}</span>
        <span className="truncate font-bold" style={{ color: colorForIntensity(block.intensity) }}>
          {zoneLabel}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[0.55rem] uppercase tracking-wider text-gray-500">{shape}</p>
    </div>
  );
}

/**
 * Tela interattiva del compositore: OGNI blocco è una barra-gruppo (forma + numero·nome
 * + durata/zona), cliccabile per selezionare e trascinabile per riordinare. In coda una
 * drop-zone tratteggiata. LOCALE al composer: NON tocca SessionBlockIntensityChart condiviso.
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap items-stretch gap-2">
            {groups.map((group) => (
              <SortableBlockGroup
                key={group.block.id}
                group={group}
                active={group.index === activeIndex}
                canDelete={blocks.length > 1}
                onSelect={onSelect}
                onDelete={onRemove}
              />
            ))}
            {/* Drop-zone (placeholder visivo: il drag-dalla-tavolozza non è ancora attivo). */}
            <div
              aria-hidden
              className="flex w-[8.5rem] shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-white/15 px-2 py-4 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-gray-600"
            >
              {t("canvasDropHere")}
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
