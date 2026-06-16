import { cn } from "@/lib/cn";

/**
 * EMPATHY in evidenza + titolo modulo (es. Dashboard, Training).
 */
export function ProductBrandHeader({
  moduleTitle,
  className,
}: {
  moduleTitle: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/empathy-wordmark-white.svg" alt="Empathy" className="h-9 w-auto sm:h-10 lg:h-12" />
      <h1 className="mt-1 text-lg font-bold text-gray-400 sm:text-xl lg:text-2xl">{moduleTitle}</h1>
    </div>
  );
}
