"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type FaqItemView = { id: string; question: string; answer: string; category: string | null };

/** Accordion FAQ (client). Le domande arrivano già risolte nel locale dal server. */
export function VetrinaFaqList({ items }: { items: FaqItemView[] }) {
  const t = useTranslations("Vetrina.faq");
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-500">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : it.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
            >
              <span className="text-sm font-semibold text-white sm:text-base">{it.question}</span>
              <span
                className={`shrink-0 text-lg text-pink-300 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                aria-hidden
              >
                +
              </span>
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden">
                <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-gray-400">{it.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
