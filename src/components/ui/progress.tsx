"use client";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full bg-(--color-primary) transition-all duration-500", indicatorClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
