import { cn } from "@/lib/utils";

export function CrmIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-[5px] border-[1.5px] border-current text-[10px] font-black leading-none",
        className,
      )}
    >
      ◉
    </span>
  );
}
