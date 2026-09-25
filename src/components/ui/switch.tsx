"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition-colors data-[state=checked]:bg-(--color-primary)",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4.5 translate-x-[3px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[-22px]" />
    </SwitchPrimitive.Root>
  );
}
