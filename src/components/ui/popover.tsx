"use client";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        className={cn("z-50 rounded-xl border border-(--color-border) bg-white p-3 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.25)]", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
