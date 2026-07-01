import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email verified — Empathy",
};

/**
 * Landing dopo conferma email riuscita (`/auth/confirm` → verifyOtp ok).
 * L'utente a questo punto ha già la sessione attiva: il bottone lo porta dentro
 * (`/access` instrada per identità).
 */
export default function EmailVerifiedPage() {
  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen scroll-mt-0 flex-col items-center justify-center gap-8 px-6 py-16 outline-none"
      >
        <div className="text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-black tracking-[0.12em] text-white transition-opacity hover:opacity-80 sm:text-3xl"
          >
            EMPATHY
          </Link>
          <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-emerald-400/25 bg-black/30 p-6 text-center backdrop-blur-md">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15">
            <CheckCircle2 className="h-6 w-6 text-emerald-300" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-white">Email verified</h1>
          <p className="text-sm leading-relaxed text-gray-300">
            Your account is active. You can now enter the platform.
          </p>
          <Link
            href="/access"
            className="empathy-btn-gradient mt-1 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-purple-500/25"
          >
            Enter
          </Link>
        </div>
      </main>
    </BrutalistAppBackdrop>
  );
}
