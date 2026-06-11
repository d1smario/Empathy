"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Pro2Link, pro2ButtonClassName, type Pro2ButtonVariant } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/** Titolo univoco per i link cross-shell resi inerti nelle viste scoped admin/coach (v2). */
const ADMIN_SCOPED_TITLE = "Disponibile nella scheda dedicata (v2)";

type Pro2LinkProps = ComponentProps<typeof Pro2Link>;

/**
 * Pro2Link verso la shell coach reso INERTE quando `adminScoped` è true:
 * stesso chrome (variant + className) ma <span> non navigabile (no href/onClick).
 */
export function AdminScopedPro2Link({ className, variant = "primary", children, ...props }: Pro2LinkProps) {
  const { adminScoped } = useActiveAthlete();
  if (adminScoped) {
    return (
      <span
        className={cn(pro2ButtonClassName(variant as Pro2ButtonVariant, className), "cursor-default opacity-50")}
        title={ADMIN_SCOPED_TITLE}
      >
        {children}
      </span>
    );
  }
  return (
    <Pro2Link className={className} variant={variant} {...props}>
      {children}
    </Pro2Link>
  );
}

type InlineLinkProps = ComponentProps<typeof Link>;

/**
 * Link testuale inline verso la shell coach reso INERTE quando `adminScoped` è true:
 * stesse classi del link ma <span> non navigabile.
 */
export function AdminScopedInlineLink({ className, children, ...props }: InlineLinkProps) {
  const { adminScoped } = useActiveAthlete();
  if (adminScoped) {
    return (
      <span className={cn(className, "cursor-default opacity-50")} title={ADMIN_SCOPED_TITLE}>
        {children}
      </span>
    );
  }
  return (
    <Link className={className} {...props}>
      {children}
    </Link>
  );
}
