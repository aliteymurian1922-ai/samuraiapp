"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTimeFa } from "@/lib/date";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = { id: string; title: string; body: string | null; isRead: boolean; priority: string; createdAt: string; link: string | null; type: string };

const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "default"> = { critical: "danger", important: "warning", low: "default" };

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: Notification[] }>("/api/notifications"),
  });

  async function markAllRead() {
    await api.post("/api/notifications/read-all");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markRead(id: string) {
    await api.post(`/api/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  const notifications = data?.notifications ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">اعلان‌ها</h1>
          <p className="text-xs text-(--color-muted)">رویدادهای مهم مربوط به شما</p>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <Button size="sm" variant="secondary" onClick={markAllRead}><CheckCheck className="size-4" /> علامت‌گذاری همه به‌عنوان خوانده‌شده</Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="اعلانی وجود ندارد" description="وقتی اتفاق مهمی در تیم شما بیفتد، اینجا نمایش داده می‌شود." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={cn("p-3.5", !n.isRead && "border-(--color-primary)/30 bg-(--color-primary-soft)/40")}>
              <Link href={n.link ?? "#"} onClick={() => !n.isRead && markRead(n.id)} className="flex items-start gap-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-(--color-primary)")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold">{n.title}</p>
                    <Badge variant={PRIORITY_VARIANT[n.priority] ?? "default"}>{n.priority === "critical" ? "بحرانی" : n.priority === "important" ? "مهم" : "عادی"}</Badge>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-(--color-muted)">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">{relativeTimeFa(n.createdAt)}</p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
