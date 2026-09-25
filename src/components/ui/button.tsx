import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-(--color-primary) text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.55)] hover:bg-indigo-700",
        secondary: "surface-card text-(--color-text) hover:bg-slate-50",
        ghost: "text-(--color-text) hover:bg-slate-100",
        outline: "border border-(--color-border) bg-transparent hover:bg-slate-50",
        danger: "bg-(--color-danger) text-white hover:bg-red-700 shadow-[0_8px_20px_-6px_rgba(220,38,38,0.5)]",
        success: "bg-(--color-success) text-white hover:bg-green-700",
        link: "text-(--color-primary) hover:underline underline-offset-4",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
