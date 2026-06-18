"use client";

import { Bell, Maximize2 } from "lucide-react";

export function MobileDashboardHeader() {
  return (
    <header className="flex items-center justify-between px-1 py-2">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-pink-500/40 bg-black/50">
          <img
            src="/brand/empathy-icon.svg"
            alt="Empathy"
            className="h-5 w-5"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <span className="text-sm font-bold tracking-wide text-white">EMPATHY OS</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10"
          aria-label="Notifiche"
        >
          <Bell className="h-4 w-4" aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-pink-500" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10"
          aria-label="Schermo intero"
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}
