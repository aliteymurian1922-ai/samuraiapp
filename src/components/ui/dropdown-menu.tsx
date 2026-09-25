"use client";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[10rem] overflow-hidden rounded-xl border border-(--color-border) bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.25)] data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-(--color-text) outline-none transition data-[highlighted]:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuSeparator = ({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Separator>) => (
  <DropdownPrimitive.Separator className={cn("my-1 h-px bg-(--color-border)", className)} {...props} />
);

export const DropdownMenuLabel = ({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Label>) => (
  <DropdownPrimitive.Label className={cn("px-2.5 py-1.5 text-[11px] font-semibold text-(--color-muted)", className)} {...props} />
);
