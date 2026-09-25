"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { relativeTimeFa } from "@/lib/date";
import { EmptyState } from "@/components/ui/empty-state";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  priority: string;
  createdAt: string;
  link: string | null;
};

export function NotificationsBell() {
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: Notification[] }>("/api/notifications"),
    refetchInterval: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex size-10 items-center justify-center rounded-xl border border-(--color-border) bg-white text-(--color-muted) transition hover:text-(--color-text)" aria-label="اعلان‌ها">
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-(--color-danger)" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
          <p className="text-sm font-bold">اعلان‌ها</p>
          {unread > 0 && <Badge variant="primary">{unread} خوانده‌نشده</Badge>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <EmptyState className="border-none" title="اعلانی وجود ندارد" description="وقتی اتفاق مهمی بیفتد، اینجا مطلع می‌شوید." />
          ) : (
            notifications.slice(0, 8).map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/app/notifications"}
                className="block border-b border-(--color-border) px-4 py-3 last:border-none hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="size-1.5 shrink-0 rounded-full bg-(--color-primary)" />}
                  <p className="truncate text-[13px] font-medium text-(--color-text)">{n.title}</p>
                </div>
                {n.body && <p className="mt-0.5 truncate text-xs text-(--color-muted)">{n.body}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{relativeTimeFa(n.createdAt)}</p>
              </Link>
            ))
          )}
        </div>
        <Link href="/app/notifications" className="block px-4 py-2.5 text-center text-xs font-medium text-(--color-primary) hover:bg-slate-50">
          مشاهده همه اعلان‌ها
        </Link>
      </PopoverContent>
    </Popover>
  );
}
