import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shell pagina Pro 2 allineata a `TrainingBuilderRichPageView` / `docs/PRO2_UI_PAGE_CANON.md`.
 * Header canonico: eyebrow → titolo modulo → descrizione. Nessun brand "EMPATHY" ripetuto
 * sulle pagine interne (si sa già dove si è): il brand vive solo nella nav/sidebar.
 */
export function Pro2ModulePageShell({
  eyebrow,
  eyebrowClassName = "text-orange-400",
  title,
  description,
  headerActions,
  children,
  className,
  contentMaxWidthClassName = "max-w-6xl",
}: {
  eyebrow: string;
  eyebrowClassName?: string;
  /** string per i moduli standard; ReactNode per titoli ricchi (es. dashboard con seconda riga in gradiente). */
  title: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  /** Extra classes on outer wrapper (es. `pb-16`). */
  className?: string;
  /** Larghezza massima del contenuto (default `max-w-6xl`; es. `max-w-none` per full-width). */
  contentMaxWidthClassName?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-full bg-gradient-to-b from-zinc-950 via-black to-black px-4 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <div className={cn("mx-auto space-y-6", contentMaxWidthClassName)}>
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className={cn("font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em]", eyebrowClassName)}>
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
            {description ? <div className="mt-2 max-w-2xl text-sm text-gray-400">{description}</div> : null}
          </div>
          {headerActions ? <div className="flex shrink-0 flex-wrap gap-2">{headerActions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
