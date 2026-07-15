"use client";

import { GripVertical, X } from "lucide-react";
import { useMemo, useRef } from "react";
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
import type { ManualPlanBlock } from "@/lib/training/builder/manual-plan-block";
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
    // Colore che sale con la zona: gradiente da startIntensity (sinistra) a
    // endIntensity (destra), così una ramp Z2→Z4 mostra la transizione di colore
    // lungo la salita. Solo resa — non tocca segmenti né calcolo del carico.
    const startColor = colorForIntensity(block.startIntensity);
    const endColor = colorForIntensity(block.endIntensity);
    return (
      <div className="relative h-full w-full">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, ${startColor}, ${endColor})`,
            boxShadow: `0 0 12px ${endColor}44`,
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
  // Trascina ≠ seleziona: memorizza dove è iniziato il pointer (fase di cattura, così
  // non interferisce coi listeners dnd-kit in bubble); a fine gesto l'onClick seleziona
  // solo se è stato un click «fermo» (spostamento ≤5px e non un drag).
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    flexGrow: Math.max(1, totalSeconds),
    flexBasis: 0,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    // FIX 6 — TUTTA la barra è trascinabile: attributes/listeners sul contenitore radice
    // (non più solo sulla maniglia). L'onClick seleziona; dnd-kit distingue click da drag
    // via activationConstraint distance:5 nei sensori, quindi un click puro seleziona e un
    // trascinamento riordina. touch-none per il drag da touch.
    <div
      ref={setNodeRef}
      style={style}
      onPointerDownCapture={(e) => {
        pointerStart.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        const s = pointerStart.current;
        pointerStart.current = null;
        if (isDragging) return;
        if (s && (Math.abs(e.clientX - s.x) > 5 || Math.abs(e.clientY - s.y) > 5)) return;
        onSelect(index);
      }}
      {...attributes}
      {...listeners}
      className={`group relative flex min-w-[2.75rem] cursor-grab touch-none flex-col active:cursor-grabbing ${isDragging ? "opacity-70" : ""}`}
    >
      {/* FIX A — Etichetta automatica per posizione: «Blocco N» (N = index+1). */}
      <div className="mb-1 truncate px-0.5 text-[0.62rem] font-semibold leading-tight text-white/90">
        <span className={active ? "text-white" : "text-white/75"}>{t("blockPositional", { n: index + 1 })}</span>
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

        {/* Maniglia drag: ora l'intera barra è trascinabile, l'icona resta solo come hint
            visivo (pointer-events-none così non intercetta pointerdown/drag). */}
        <span
          className="pointer-events-none absolute left-0 top-0 z-10 rounded-br-md bg-black/55 p-0.5 text-gray-400 opacity-0 transition group-hover:opacity-100"
          title={t("dragToReorder")}
          aria-hidden
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>

        {/* Elimina sull'angolo opposto — stopPropagation su pointerdown+click così NON innesca il drag. */}
        {canDelete ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
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
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Caption sotto la tela */}
      <p className="text-center text-[0.6rem] text-gray-500">{t("dragHint")}</p>
    </div>
  );
}
