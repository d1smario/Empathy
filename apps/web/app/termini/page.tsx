import type { Metadata } from "next";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Link } from "@/components/ui/empathy";

export const metadata: Metadata = {
  title: "Termini di Servizio — Empathy",
  description: "Termini e condizioni d'uso della piattaforma EMPATHY (Day One Sciences Sagl).",
  robots: { index: true, follow: true },
};

/**
 * Pagina pubblica Termini di Servizio. Placeholder: testo definitivo in arrivo.
 * Linkata dal consenso in fase di registrazione (`/registrati`).
 */
export default function TerminiPage() {
  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Pro2Link href="/" className="text-sm text-white/70 hover:text-white">
            ← Torna alla home
          </Pro2Link>
        </header>

        <section
          className="rounded-2xl border border-white/12 p-6 md:p-8"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(168,85,247,0.12), transparent 30%), radial-gradient(circle at top right, rgba(255,93,122,0.12), transparent 24%), linear-gradient(180deg, rgba(12,12,16,0.96), rgba(7,8,11,0.98))",
          }}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-white/60">Termini di Servizio</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight text-white md:text-4xl">
            Condizioni d&apos;uso della piattaforma EMPATHY.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/85 md:text-base">
            Questa pagina raccoglierà i termini e le condizioni d&apos;uso del servizio: oggetto del contratto,
            account e responsabilità dell&apos;utente, abbonamenti e pagamenti, limitazioni di responsabilità,
            recesso e foro competente. Il testo definitivo è in fase di redazione.
          </p>
        </section>

        <section
          className="rounded-2xl border border-amber-400/20 p-5 md:p-6"
          style={{ background: "linear-gradient(180deg, rgba(14,17,22,0.94), rgba(8,10,14,0.98))" }}
        >
          <h2 className="text-xl font-semibold text-white">Riferimenti</h2>
          <ul className="mt-4 grid gap-2 text-sm text-white/90">
            <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <strong className="text-white">Titolare:</strong> Day One Sciences Sagl, Via Nassa 15, 6900 Lugano, Svizzera
            </li>
            <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <strong className="text-white">Informativa privacy:</strong>{" "}
              <Pro2Link href="/privacy" className="text-cyan-200/90 hover:underline">
                /privacy
              </Pro2Link>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5">
          <p className="text-xs leading-relaxed text-white/75 md:text-sm">
            Nota: EMPATHY PRO non è un dispositivo medico e non fornisce diagnosi cliniche. Documento soggetto ad
            aggiornamenti.
          </p>
        </section>
      </main>
    </BrutalistAppBackdrop>
  );
}
