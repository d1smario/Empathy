"use client";

import { useLocale, useTranslations } from "next-intl";

export type EventItemView = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  eventDate: string | null;
  location: string | null;
  ctaUrl: string | null;
};

/** "Prossimi eventi" (blog): card immagine + testo. Con empty state "rimani connesso…". */
export function VetrinaEventsList({ items }: { items: EventItemView[] }) {
  const t = useTranslations("Vetrina.events");
  const locale = useLocale();

  const fmt = (iso: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "it-CH", { dateStyle: "long", timeStyle: "short" }).format(d);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/10 to-pink-600/10 p-10 text-center">
        <div className="text-3xl" aria-hidden>
          📅
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-300 sm:text-base">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {items.map((ev) => {
        const when = fmt(ev.eventDate);
        return (
          <article key={ev.id} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-colors hover:border-pink-400/30">
            {ev.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.imageUrl} alt={ev.title} className="h-48 w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-24 w-full bg-gradient-to-br from-purple-600/20 to-pink-600/20" aria-hidden />
            )}
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-pink-300">
                {when ? <span>{when}</span> : null}
                {when && ev.location ? <span className="text-gray-600">·</span> : null}
                {ev.location ? <span className="text-gray-400">{ev.location}</span> : null}
              </div>
              <h3 className="mt-2 text-lg font-black tracking-tight text-white">{ev.title}</h3>
              {ev.body ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-400">{ev.body}</p> : null}
              {ev.ctaUrl ? (
                <a
                  href={ev.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-pink-300 transition-colors hover:text-pink-200"
                >
                  {t("cta")} →
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
