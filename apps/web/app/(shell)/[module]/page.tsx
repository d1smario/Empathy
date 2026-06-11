import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/navigation/ModulePlaceholder";
import { pathSegmentFromHref, PRODUCT_MODULE_NAV } from "@/core/navigation/module-registry";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

/** Only registry segments; anything else → 404. */
export const dynamicParams = false;

export function generateStaticParams(): { module: string }[] {
  /** Pagine dedicate sotto `(shell)/<segment>/page.tsx` escludono il placeholder `[module]`. */
  return PRODUCT_MODULE_NAV.map((item) => ({ module: pathSegmentFromHref(item.href) })).filter(
    (p) =>
      p.module !== "nutrition" &&
      p.module !== "bioenergetics" &&
      p.module !== "biomechanics" &&
      p.module !== "aerodynamics" &&
      p.module !== "profile" &&
      p.module !== "physiology" &&
      p.module !== "health" &&
      p.module !== "calendario" &&
      p.module !== "commissioni" &&
      p.module !== "athletes" &&
      p.module !== "dashboard",
  );
}

export function generateMetadata({ params }: { params: { module: string } }): Metadata {
  const match = PRODUCT_MODULE_NAV.find((item) => pathSegmentFromHref(item.href) === params.module);
  if (!match) return {};
  return { title: match.label };
}

type PageProps = {
  params: { module: string };
};

export default async function ShellModulePage({ params }: PageProps) {
  const match = PRODUCT_MODULE_NAV.find((item) => pathSegmentFromHref(item.href) === params.module);
  if (!match) notFound();
  // Il campo `roles` del registry vale anche via URL diretto, non solo in sidebar.
  await redirectIfShellRoleNotAllowed(match.roles);
  return <ModulePlaceholder module={match.module} />;
}
