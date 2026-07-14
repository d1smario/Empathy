import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupportedLocale } from "@/lib/i18n/supported-locales";

export type FaqEntry = {
  id: string;
  questionIt: string;
  answerIt: string;
  questionEn: string;
  answerEn: string;
  questionTr: string;
  answerTr: string;
  questionDe: string;
  answerDe: string;
  questionFr: string;
  answerFr: string;
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
  question_tr: string | null;
  answer_tr: string | null;
  question_de: string | null;
  answer_de: string | null;
  question_fr: string | null;
  answer_fr: string | null;
  category: string | null;
  sort_order: number | null;
  published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Colonne per lingua tradotta (le lingue senza colonna cadono su EN→IT). */
const LOCALE_COLUMNS: Partial<Record<SupportedLocale, { q: keyof Row; a: keyof Row }>> = {
  it: { q: "question_it", a: "answer_it" },
  en: { q: "question_en", a: "answer_en" },
  tr: { q: "question_tr", a: "answer_tr" },
  de: { q: "question_de", a: "answer_de" },
  fr: { q: "question_fr", a: "answer_fr" },
};

const SELECT_COLS =
  "id, question_it, answer_it, question_en, answer_en, question_tr, answer_tr, question_de, answer_de, question_fr, answer_fr, category, sort_order, published";

function mapRow(r: Row): FaqEntry {
  return {
    id: r.id,
    questionIt: r.question_it ?? "",
    answerIt: r.answer_it ?? "",
    questionEn: r.question_en ?? "",
    answerEn: r.answer_en ?? "",
    questionTr: r.question_tr ?? "",
    answerTr: r.answer_tr ?? "",
    questionDe: r.question_de ?? "",
    answerDe: r.answer_de ?? "",
    questionFr: r.question_fr ?? "",
    answerFr: r.answer_fr ?? "",
    category: r.category ?? null,
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
    published: r.published === true,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

/** FAQ pubblicate, risolte nel locale richiesto (colonna lingua → EN → IT). Server-side, service-role. */
export async function loadPublishedFaq(locale: SupportedLocale): Promise<PublicFaqItem[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("faq_entries")
    .select(SELECT_COLS)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const cols = LOCALE_COLUMNS[locale];
  return (data as Row[])
    .map((r) => {
      const locQ = cols ? (r[cols.q] as string | null) : null;
      const locA = cols ? (r[cols.a] as string | null) : null;
      const question = locQ?.trim() || r.question_en?.trim() || r.question_it?.trim() || "";
      const answer = locA?.trim() || r.answer_en?.trim() || r.answer_it?.trim() || "";
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
    .select(`${SELECT_COLS}, created_at, updated_at`)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Row[]).map(mapRow);
}
