"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * FooterSection — public landing footer.
 *
 * Self-contained: takes NO props. Edit the copy in the FOOTER const below.
 * The id="contatti" anchor satisfies the Navbar #contatti link.
 */

const FOOTER = {
  wordmark: "EMPATHY",
  links: [
    { labelKey: "linkPrivacy", href: "/privacy" },
    { labelKey: "linkTermini", href: "/termini" },
    { labelKey: "linkAccedi", href: "/access" },
  ],
  contactEmail: "hello@empathy.pro",
  company: {
    name: "Day One Sciences Sagl",
    address: "Via Nassa 15, 6900 Lugano",
    vat: "CHE-248.668.947",
  },
} as const;

const VETRINA_LINKS = [
  { key: "comeFunziona", href: "/come-funziona" },
  { key: "faq", href: "/faq" },
  { key: "prezzi", href: "/pricing" },
  { key: "contatti", href: "/contatti" },
  { key: "collabora", href: "/contatti?tab=collabora" },
] as const;

export function FooterSection() {
  const t = useTranslations("FooterSection");
  const tv = useTranslations("Vetrina.footer");
  const year = new Date().getFullYear();

  return (
    <footer
      id="contatti"
      className="relative mt-24 border-t border-white/10 bg-black/40 backdrop-blur-md md:mt-32"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm text-center md:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/empathy-wordmark-white.png"
              alt={FOOTER.wordmark}
              className="h-7 w-auto"
            />
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              {t("tagline")}
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-gray-400 md:justify-end"
          >
            {VETRINA_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="underline-offset-4 transition-colors hover:text-pink-300 hover:underline"
              >
                {tv(link.key)}
              </Link>
            ))}
            {FOOTER.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="underline-offset-4 transition-colors hover:text-pink-300 hover:underline"
              >
                {t(link.labelKey)}
              </Link>
            ))}
            <a
              href={`mailto:${FOOTER.contactEmail}`}
              className="underline-offset-4 transition-colors hover:text-pink-300 hover:underline"
            >
              {t("contactLabel")}
            </a>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/5 pt-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
            <span className="text-gray-400">{FOOTER.company.name}</span>
            <span aria-hidden className="text-gray-700">
              ·
            </span>
            <span>{FOOTER.company.address}</span>
            <span aria-hidden className="text-gray-700">
              ·
            </span>
            <span className="font-mono tracking-tight">{FOOTER.company.vat}</span>
          </p>
          <p className="text-center text-gray-600 sm:text-right">
            © {year} {FOOTER.company.name}. {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
