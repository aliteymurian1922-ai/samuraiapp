"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, LogOut, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceProvider, type WorkspaceContextValue } from "@/lib/workspace-context";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { CommandPalette } from "@/components/layout/command-palette";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MAIN_NAV, SECONDARY_NAV } from "@/lib/nav";
import { SamuraiMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/api-client";

export function AppShell({ value, children }: { value: WorkspaceContextValue; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { setCommandPaletteOpen } = useUIStore();

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <WorkspaceProvider value={value}>
      <div className="flex min-h-screen bg-(--color-bg)">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-(--color-border) bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
            <button className="flex size-9 items-center justify-center rounded-lg hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="باز کردن منو">
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <SamuraiMark size={24} />
            </div>

            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="ml-auto flex h-10 flex-1 max-w-sm items-center gap-2 rounded-xl border border-(--color-border) bg-white px-3 text-sm text-(--color-muted) transition hover:bg-slate-50 sm:flex-none sm:w-72"
            >
              <Search className="size-4" />
              <span className="flex-1 text-right sm:text-right">جستجو در سامورایی...</span>
              <kbd className="kbd hidden sm:inline-flex">⌘K</kbd>
            </button>

            <div className="flex items-center gap-2">
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full">
                    <Avatar name={value.user.name} color={value.user.avatarColor} size={38} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2.5 py-2">
                    <p className="truncate text-sm font-semibold">{value.user.name}</p>
                    <p className="truncate text-xs text-(--color-muted)">{value.user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/app/settings")}>
                    <UserIcon className="size-4" /> تنظیمات حساب
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={logout} className="text-(--color-danger)">
                    <LogOut className="size-4" /> خروج از حساب
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pb-8 sm:pt-6">{children}</main>
        </div>

        <MobileNav />
        <CommandPalette />
        <CreateTaskDialog />
        <CreateProjectDialog />
        <CreateMeetingDialog />
        <TaskDetailDrawer />

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative mr-auto flex h-full w-72 flex-col bg-white p-4 shadow-xl animate-fade-in">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SamuraiMark size={26} />
                  <span className="font-bold">سامورایی</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="بستن">
                  <X className="size-4" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
                {[...MAIN_NAV, ...SECONDARY_NAV].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      pathname.startsWith(item.href) ? "bg-(--color-primary-soft) text-(--color-primary)" : "text-(--color-muted)",
                    )}
                  >
                    <item.icon className="size-[18px]" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <button onClick={logout} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-(--color-danger)">
                <LogOut className="size-[18px]" /> خروج از حساب
              </button>
            </div>
          </div>
        )}
      </div>
    </WorkspaceProvider>
  );
}
