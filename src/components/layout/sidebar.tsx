"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, SECONDARY_NAV } from "@/lib/nav";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { cn } from "@/lib/utils";
import { SamuraiMark } from "@/components/brand/logo";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-(--color-border) bg-white/70 px-3 py-4 backdrop-blur-sm lg:flex">
      <div className="mb-4 flex items-center gap-2 px-1">
        <SamuraiMark size={28} />
        <span className="text-[15px] font-bold">سامورایی</span>
      </div>

      <WorkspaceSwitcher />

      <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin">
        {MAIN_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                active ? "bg-(--color-primary-soft) text-(--color-primary)" : "text-(--color-muted) hover:bg-slate-100 hover:text-(--color-text)",
              )}
            >
              <item.icon className="size-[18px]" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 flex flex-col gap-1 border-t border-(--color-border) pt-3">
        {SECONDARY_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                active ? "bg-(--color-primary-soft) text-(--color-primary)" : "text-(--color-muted) hover:bg-slate-100 hover:text-(--color-text)",
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
