"use client";

import { type LucideIcon } from "lucide-react";
import type { DashboardArea, DashboardAreaKey } from "@/lib/dashboard/dashboard-scores";

export type BadgeLayout = "vertical" | "horizontal";

export type DashboardAreaBadgeProps = {
  area?: DashboardArea;
  keyName: DashboardAreaKey;
  label: string;
  color: string;
  icon: LucideIcon;
  layout?: BadgeLayout;
  size?: "sm" | "md";
};

function statusText(area: DashboardArea | undefined, on: boolean): string {
  if (!on || !area) return "in attesa";
  if (area.status === "ottimale") return "Ottimale";
  if (area.status === "buona") return "Buona";
  if (area.status === "attenzione") return "Attenzione";
  if (area.status === "bassa") return area.higherIsBetter ? "Bassa" : "Ottimale";
  return "";
}

export function DashboardAreaBadge({
  area,
  keyName,
  label,
  color,
  icon: Icon,
  layout = "vertical",
  size = "md",
}: DashboardAreaBadgeProps) {
  const on = Boolean(area?.hasData && area?.score != null);
  const score = on ? Math.round(area!.score as number) : null;
  const status = statusText(area, on);

  const ringSize = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? 16 : 19;
  const scoreClass = size === "sm" ? "text-base" : "text-lg";

  if (layout === "horizontal") {
    return (
      <div className="flex items-center gap-3 text-left">
        <div
          className={`${ringSize} flex shrink-0 items-center justify-center rounded-full border-2 bg-black/70`}
          style={{ borderColor: color, boxShadow: on ? `0 0 14px -3px ${color}` : undefined }}
        >
          <Icon size={iconSize} style={{ color }} aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[0.6rem] uppercase tracking-wider" style={{ color }}>
            {label}
          </div>
          <div className={`${scoreClass} font-bold leading-tight tabular-nums`} style={{ color: on ? "#ffffff" : "#6b7280" }}>
            {score ?? "—"}
          </div>
          <div className="text-[0.55rem] leading-tight" style={{ color: on ? color : "#6b7280" }}>
            {status}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="truncate text-[0.55rem] uppercase tracking-wider" style={{ color, opacity: on ? 0.9 : 0.6 }}>
        {label}
      </div>
      <div
        className={`${ringSize} mx-auto mt-0.5 flex items-center justify-center rounded-full border-2 bg-black/70`}
        style={{ borderColor: color, opacity: on ? 1 : 0.5, boxShadow: on ? `0 0 14px -3px ${color}` : undefined }}
      >
        <Icon size={iconSize} style={{ color }} aria-hidden />
      </div>
      <div className={`${scoreClass} font-bold leading-tight tabular-nums`} style={{ color: on ? "#ffffff" : "#6b7280" }}>
        {score ?? "—"}
      </div>
      <div className="text-[0.6rem] leading-tight" style={{ color: on ? color : "#6b7280" }}>
        {status}
      </div>
    </div>
  );
}
