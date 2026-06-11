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
      <p className="text-3xl font-black tracking-[0.12em] text-white sm:text-4xl lg:text-5xl">EMPATHY</p>
      <h1 className="mt-1 text-lg font-bold text-gray-400 sm:text-xl lg:text-2xl">{moduleTitle}</h1>
    </div>
  );
}
