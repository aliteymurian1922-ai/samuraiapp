import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-border) bg-white/60 px-6 py-12 text-center", className)}>
      {icon && <div className="flex size-12 items-center justify-center rounded-2xl bg-(--color-primary-soft) text-(--color-primary)">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--color-text)">{title}</p>
        {description && <p className="text-xs text-(--color-muted)">{description}</p>}
      </div>
      {action}
    </div>
  );
}
