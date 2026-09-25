import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      className={cn(
        orientation === "horizontal" ? "h-px w-full bg-(--color-border)" : "w-px h-full bg-(--color-border)",
        className,
      )}
    />
  );
}
