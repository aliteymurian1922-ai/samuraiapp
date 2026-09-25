import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", {
  variants: {
    variant: {
      default: "bg-slate-100 text-slate-700",
      primary: "bg-(--color-primary-soft) text-(--color-primary)",
      success: "bg-(--color-success-soft) text-(--color-success)",
      warning: "bg-(--color-warning-soft) text-(--color-warning)",
      danger: "bg-(--color-danger-soft) text-(--color-danger)",
      outline: "border border-(--color-border) text-(--color-muted)",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
