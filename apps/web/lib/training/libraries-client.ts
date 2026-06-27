"use client";

import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import {
  LIFESTYLE_PROTOCOL_LIBRARY,
  TEAM_SPORT_DRILL_LIBRARY,
  type LifestyleProtocol,
  type TechnicalDrill,
} from "@/lib/training/libraries";

let drillsCache: Promise<TechnicalDrill[]> | null = null;
let protocolsCache: Promise<LifestyleProtocol[]> | null = null;

/**
 * Drill tecnici lato client (browser→Supabase diretto, RLS anon-read). Memoizzato a livello
 * di modulo; fallback su `TEAM_SPORT_DRILL_LIBRARY` se browser client assente / tabella vuota /
 * query in errore → comportamento invariato.
 */
export function loadTechnicalDrillsClient(): Promise<TechnicalDrill[]> {
  if (drillsCache) return drillsCache;
  drillsCache = (async () => {
    try {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return TEAM_SPORT_DRILL_LIBRARY;
      const { data, error } = await supabase
        .from("technical_sport_drills")
        .select("data")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ data: TechnicalDrill }>;
      if (rows.length === 0) return TEAM_SPORT_DRILL_LIBRARY;
      return rows.map((row) => row.data);
    } catch {
      return TEAM_SPORT_DRILL_LIBRARY;
    }
  })();
  return drillsCache;
}

/** Protocolli lifestyle lato client — stesso pattern dei drill. */
export function loadLifestyleProtocolsClient(): Promise<LifestyleProtocol[]> {
  if (protocolsCache) return protocolsCache;
  protocolsCache = (async () => {
    try {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return LIFESTYLE_PROTOCOL_LIBRARY;
      const { data, error } = await supabase
        .from("lifestyle_protocols")
        .select("data")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ data: LifestyleProtocol }>;
      if (rows.length === 0) return LIFESTYLE_PROTOCOL_LIBRARY;
      return rows.map((row) => row.data);
    } catch {
      return LIFESTYLE_PROTOCOL_LIBRARY;
    }
  })();
  return protocolsCache;
}
