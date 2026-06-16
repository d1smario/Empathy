"use client";

import Link from "next/link";

/**
 * FooterSection — public landing footer.
 *
 * Self-contained: takes NO props. Edit the copy in the FOOTER const below.
 * The id="contatti" anchor satisfies the Navbar #contatti link.
 */

const FOOTER = {
  wordmark: "EMPATHY",
  tagline: "Performance & metabolic adaptation platform",
  links: [
    { label: "Privacy", href: "/privacy" },
    { label: "Termini", href: "/termini" },
    { label: "Accedi", href: "/access" },
  ],
  contactLabel: "Contatti",
  contactEmail: "hello@empathy.pro",
  company: {
    name: "Day One Sciences Sagl",
    address: "Via Nassa 15, 6900 Lugano",
    vat: "CHE-248.668.947",
  },
  rights: "Tutti i diritti riservati.",
} as const;

export function FooterSection() {
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
              src="/brand/empathy-wordmark-white.svg"
              alt={FOOTER.wordmark}
              className="h-7 w-auto"
            />
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              {FOOTER.tagline}
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-gray-400 md:justify-end"
          >
            {FOOTER.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="underline-offset-4 transition-colors hover:text-pink-300 hover:underline"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={`mailto:${FOOTER.contactEmail}`}
              className="underline-offset-4 transition-colors hover:text-pink-300 hover:underline"
            >
              {FOOTER.contactLabel}
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
            © {year} {FOOTER.company.name}. {FOOTER.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
