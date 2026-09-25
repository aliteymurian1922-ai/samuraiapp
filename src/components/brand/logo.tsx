import { cn } from "@/lib/utils";

export function SamuraiMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="13" fill="url(#samurai-gradient)" />
      <path d="M14 34L24 10L34 34" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 26H29.5" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
      <defs>
        <linearGradient id="samurai-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SamuraiLogo({ className, iconSize = 30 }: { className?: string; iconSize?: number }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SamuraiMark size={iconSize} />
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-tight text-(--color-text)">سامورایی</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-(--color-muted)">Samurai</span>
      </div>
    </div>
  );
}
