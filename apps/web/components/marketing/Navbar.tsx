import Link from "next/link";

/**
 * Marketing Navbar — minimal fixed header.
 *
 * LEFT:  "EMPATHY" wordmark linking to the landing root.
 * RIGHT: two CTAs — "Accedi" (ghost) and "Registrati" (gradient).
 *
 * No center nav links and no hamburger: with only two compact buttons the
 * layout works identically on mobile and desktop, so this stays a Server
 * Component (no "use client" needed).
 */

const COPY = {
  brand: "EMPATHY",
  login: "Accedi",
  register: "Registrati",
} as const;

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-lg font-black tracking-[0.15em] text-white transition-opacity hover:opacity-80"
        >
          {COPY.brand}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/access"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-300 backdrop-blur-xl transition-colors hover:border-purple-500/40 hover:text-white sm:px-5"
          >
            {COPY.login}
          </Link>
          <Link
            href="/registrati"
            className="empathy-btn-gradient rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg shadow-purple-500/25 sm:px-5"
          >
            {COPY.register}
          </Link>
        </div>
      </nav>
    </header>
  );
}
