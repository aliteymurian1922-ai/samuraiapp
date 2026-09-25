"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, FolderKanban, ListChecks, Video } from "lucide-react";
import { MOBILE_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function MobileNav() {
  const pathname = usePathname();
  const { setCreateTaskOpen, setCreateProjectOpen, setCreateMeetingOpen } = useUIStore();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-(--color-border) bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur lg:hidden">
      {MOBILE_NAV.slice(0, 2).map((item) => (
        <MobileNavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="-mt-6 flex size-14 items-center justify-center rounded-full bg-(--color-primary) text-white shadow-[0_10px_25px_-6px_rgba(79,70,229,0.6)] active:scale-95">
            <Plus className="size-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-48">
          <DropdownMenuItem onSelect={() => setCreateTaskOpen(true)}>
            <ListChecks className="size-4" /> وظیفه جدید
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCreateProjectOpen(true)}>
            <FolderKanban className="size-4" /> پروژه جدید
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCreateMeetingOpen(true)}>
            <Video className="size-4" /> جلسه جدید
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {MOBILE_NAV.slice(2).map((item) => (
        <MobileNavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}
    </nav>
  );
}

function MobileNavLink({ item, active }: { item: (typeof MOBILE_NAV)[number]; active: boolean }) {
  return (
    <Link href={item.href} className={cn("flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium", active ? "text-(--color-primary)" : "text-(--color-muted)")}>
      <item.icon className="size-5" />
      {item.label}
    </Link>
  );
}
