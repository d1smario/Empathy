import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Link } from "@/components/ui/empathy";
import { empathyTermsLastUpdated, empathyTermsSections } from "@/lib/legal/empathy-terms-sections";

export const metadata: Metadata = {
  title: "Terms of Service — Empathy",
  description: "Terms and conditions of use of the EMPATHY platform (Day One Sagl).",
  robots: { index: true, follow: true },
};

/**
 * Pagina pubblica Termini di Servizio. Linkata dal consenso in registrazione (`/registrati`)
 * e dal footer. Testo GENERICO di base (vedi lib/legal/empathy-terms-sections.ts): sarà
 * sostituito dal testo legale definitivo del Titolare.
 */
export default async function TerminiPage() {
  const t = await getTranslations("TerminiPage");
  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Pro2Link href="/" className="text-sm text-white/70 hover:text-white">
            {t("backToHome")}
          </Pro2Link>
        </header>

        <section
          className="rounded-2xl border border-white/12 p-6 md:p-8"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(168,85,247,0.12), transparent 30%), radial-gradient(circle at top right, rgba(255,93,122,0.12), transparent 24%), linear-gradient(180deg, rgba(12,12,16,0.96), rgba(7,8,11,0.98))",
          }}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-white/60">{t("eyebrow")}</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight text-white md:text-4xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/85 md:text-base">
            {t("heroIntro")}
          </p>
          <p className="mt-3 text-xs text-white/55">{t("lastUpdated", { date: empathyTermsLastUpdated })}</p>
        </section>

        <section
          className="rounded-2xl border border-amber-400/20 p-5 md:p-6"
          style={{ background: "linear-gradient(180deg, rgba(14,17,22,0.94), rgba(8,10,14,0.98))" }}
        >
          <h2 className="text-xl font-semibold text-white">{t("referencesTitle")}</h2>
          <ul className="mt-4 grid gap-2 text-sm text-white/90">
            <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              {t.rich("dataController", {
                b: (chunks) => <strong className="text-white">{chunks}</strong>,
              })}
            </li>
            <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <strong className="text-white">{t("privacyPolicyLabel")}</strong>{" "}
              <Pro2Link href="/privacy" className="text-cyan-200/90 hover:underline">
                /privacy
              </Pro2Link>
            </li>
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {empathyTermsSections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-[rgba(8,9,13,0.98)] p-5 md:p-6"
            >
              <h3 className="text-lg font-semibold leading-snug text-white">{section.title}</h3>
              <div className="mt-3 grid gap-2.5">
                {section.body.map((paragraph, i) => (
                  <p key={`${section.title}-${i}`} className="text-sm leading-relaxed text-white/90">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5">
          <p className="text-xs leading-relaxed text-white/75 md:text-sm">
            {t("disclaimer")}
          </p>
        </section>
      </main>
    </BrutalistAppBackdrop>
  );
}
