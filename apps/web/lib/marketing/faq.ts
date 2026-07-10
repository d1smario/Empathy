import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupportedLocale } from "@/lib/i18n/supported-locales";

export type FaqEntry = {
  id: string;
  questionIt: string;
  answerIt: string;
  questionEn: string;
  answerEn: string;
  category: string | null;
  sortOrder: number;
  published: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicFaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

type Row = {
  id: string;
  question_it: string | null;
  answer_it: string | null;
  question_en: string | null;
  answer_en: string | null;
  category: string | null;
  sort_order: number | null;
  published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapRow(r: Row): FaqEntry {
  return {
    id: r.id,
    questionIt: r.question_it ?? "",
    answerIt: r.answer_it ?? "",
    questionEn: r.question_en ?? "",
    answerEn: r.answer_en ?? "",
    category: r.category ?? null,
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
    published: r.published === true,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

/** FAQ pubblicate, risolte nel locale richiesto (server-side, service-role). */
export async function loadPublishedFaq(locale: SupportedLocale): Promise<PublicFaqItem[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("faq_entries")
    .select("id, question_it, answer_it, question_en, answer_en, category, sort_order, published")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Row[])
    .map((r) => {
      const en = locale === "en";
      const question = (en ? r.question_en : r.question_it)?.trim() || (en ? r.question_it : r.question_en)?.trim() || "";
      const answer = (en ? r.answer_en : r.answer_it)?.trim() || (en ? r.answer_it : r.answer_en)?.trim() || "";
      return { id: r.id, question, answer, category: r.category ?? null };
    })
    .filter((item) => item.question.length > 0 && item.answer.length > 0);
}

/** Tutte le FAQ (admin). */
export async function loadAllFaq(): Promise<FaqEntry[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("faq_entries")
    .select("id, question_it, answer_it, question_en, answer_en, category, sort_order, published, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Row[]).map(mapRow);
}
