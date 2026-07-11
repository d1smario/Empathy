import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupportedLocale } from "@/lib/i18n/supported-locales";

export type EventEntry = {
  id: string;
  titleIt: string;
  titleEn: string;
  bodyIt: string;
  bodyEn: string;
  imageUrl: string | null;
  eventDate: string | null;
  location: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  published: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicEventItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  eventDate: string | null;
  location: string | null;
  ctaUrl: string | null;
};

type Row = {
  id: string;
  title_it: string | null;
  title_en: string | null;
  body_it: string | null;
  body_en: string | null;
  image_url: string | null;
  event_date: string | null;
  location: string | null;
  cta_url: string | null;
  sort_order: number | null;
  published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapRow(r: Row): EventEntry {
  return {
    id: r.id,
    titleIt: r.title_it ?? "",
    titleEn: r.title_en ?? "",
    bodyIt: r.body_it ?? "",
    bodyEn: r.body_en ?? "",
    imageUrl: r.image_url ?? null,
    eventDate: r.event_date ?? null,
    location: r.location ?? null,
    ctaUrl: r.cta_url ?? null,
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
    published: r.published === true,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

const SELECT =
  "id, title_it, title_en, body_it, body_en, image_url, event_date, location, cta_url, sort_order, published, created_at, updated_at";

/** Prossimi eventi pubblicati (senza data o futuri), risolti nel locale. */
export async function loadPublishedUpcomingEvents(locale: SupportedLocale): Promise<PublicEventItem[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const cutoff = new Date(Date.now() - 86_400_000).toISOString(); // include gli eventi di ieri (in corso)
  const { data, error } = await admin
    .from("vetrina_events")
    .select(SELECT)
    .eq("published", true)
    .or(`event_date.is.null,event_date.gte.${cutoff}`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as Row[])
    .map((r) => {
      const en = locale === "en";
      const title = (en ? r.title_en : r.title_it)?.trim() || (en ? r.title_it : r.title_en)?.trim() || "";
      const body = (en ? r.body_en : r.body_it)?.trim() || (en ? r.body_it : r.body_en)?.trim() || "";
      return {
        id: r.id,
        title,
        body,
        imageUrl: r.image_url ?? null,
        eventDate: r.event_date ?? null,
        location: r.location ?? null,
        ctaUrl: r.cta_url ?? null,
      };
    })
    .filter((item) => item.title.length > 0);
}

/** Tutti gli eventi (admin). */
export async function loadAllEvents(): Promise<EventEntry[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("vetrina_events")
    .select(SELECT)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as Row[]).map(mapRow);
}
