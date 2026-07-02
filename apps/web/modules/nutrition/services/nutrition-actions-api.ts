"use client";

import type { AthleteMemory, RealityIngestionEnvelope } from "@/lib/empathy/schemas";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

export async function saveNutritionLookupItem(input: {
  source: string;
  brand: string | null;
  product_name: string;
  category: string;
  kcal_100g: number | null;
  cho_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  sodium_mg_100g: number | null;
  metadata: Record<string, unknown>;
}) {
  const response = await fetch("/api/nutrition/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Nutrition catalog save failed");
  }
}

export async function saveNutritionDeviceExport(input: {
  athlete_id: string;
  provider: string;
  external_ref?: string;
  payload: Record<string, unknown>;
}) {
  const response = await fetch("/api/nutrition/device-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Nutrition device export save failed");
  }
  return (await response.json()) as {
    status: "ok";
    ingestion?: RealityIngestionEnvelope | null;
    athleteMemory?: AthleteMemory | null;
  };
}

export async function fetchNutritionMediaRows(): Promise<{
  rows: Array<Record<string, unknown>>;
  error?: string | null;
}> {
  // Lettura diretta browser→Supabase dei media nutrizione (RLS select pubblica su media_assets).
  const supabase = createEmpathyBrowserSupabase();
  if (!supabase) return { rows: [], error: "Nutrition media fetch failed" };
  const { data, error } = await supabase
    .from("media_assets")
    .select("entity_type, entity_key, media_kind, url, active, sort_order")
    .eq("domain", "nutrition")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as Array<Record<string, unknown>>, error: null };
}

export async function saveNutritionProfileConfig(input: {
  athleteId: string;
  nutrition_config: Record<string, unknown>;
  routine_config: Record<string, unknown>;
}) {
  const response = await fetch("/api/nutrition/profile-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Nutrition profile config save failed");
  }
}

