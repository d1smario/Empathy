import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

/**
 * Placeholder ordinato per i pannelli admin non ancora implementati.
 * Stesso shell di pagina dei moduli, accento neutro "slate".
 */
export function AdminPlaceholder({
  title,
  intro,
  subtitle,
  body,
  icon,
}: {
  title: string;
  intro: string;
  subtitle: string;
  body: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <Pro2ModulePageShell
      eyebrow={`${title} · Admin`}
      eyebrowClassName="text-rose-400"
      title={title}
      description={<span className="text-sm text-gray-400">{intro}</span>}
    >
      <Pro2SectionCard accent="slate" title="In arrivo" subtitle={subtitle} icon={icon}>
        <div className="text-sm leading-relaxed text-gray-400">{body}</div>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
