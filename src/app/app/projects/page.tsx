"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/use-data";
import { useUIStore } from "@/stores/ui-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatJalaliDate } from "@/lib/date";
import { toPersianDigits } from "@/lib/utils";
import { RISK_LEVEL_LABEL_FA } from "@/lib/risk";
import { FolderKanban, Plus, Search } from "lucide-react";

const STATUS_LABELS: Record<string, string> = { active: "فعال", on_hold: "متوقف‌شده", completed: "تکمیل‌شده", archived: "بایگانی‌شده" };
const PRIORITY_LABELS: Record<string, string> = { critical: "بحرانی", high: "بالا", medium: "متوسط", low: "پایین" };

export default function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const { setCreateProjectOpen } = useUIStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const projects = useMemo(() => {
    const list = data?.projects ?? [];
    return list.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, search, status]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold">پروژه‌ها</h1>
          <p className="text-xs text-(--color-muted)">مدیریت و پیگیری همه پروژه‌های Workspace</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/project-templates"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-(--color-border) bg-white px-4 text-xs font-semibold text-(--color-text) transition hover:bg-slate-50"
          >
            قالب‌های پروژه
          </Link>
          <Button onClick={() => setCreateProjectOpen(true)}><Plus className="size-4" /> پروژه جدید</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="جستجوی پروژه..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", "active", "on_hold", "completed", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${status === s ? "bg-(--color-primary) text-white" : "bg-white text-(--color-muted) border border-(--color-border)"}`}
            >
              {s === "all" ? "همه" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="پروژه‌ای یافت نشد"
          description="هنوز پروژه‌ای ایجاد نکرده‌اید یا فیلتر فعلی نتیجه‌ای ندارد."
          action={<Button size="sm" onClick={() => setCreateProjectOpen(true)}>ایجاد اولین پروژه</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}`}>
              <Card className="h-full p-4 transition hover:shadow-[var(--shadow-neu-md)]">
                <div className="flex items-center justify-between">
                  <div className="size-2.5 rounded-full" style={{ background: p.color ?? "#4f46e5" }} />
                  <Badge variant={p.health.level === "healthy" ? "success" : p.health.level === "at_risk" ? "warning" : "danger"}>
                    {RISK_LEVEL_LABEL_FA[p.health.level]}
                  </Badge>
                </div>
                <h3 className="mt-3 truncate text-sm font-bold text-(--color-text)">{p.name}</h3>
                <p className="mt-1 line-clamp-2 h-8 text-xs text-(--color-muted)">{p.description || "بدون توضیح"}</p>
                <Progress value={p.progress} className="mt-3" />
                <div className="mt-2 flex items-center justify-between text-[11px] text-(--color-muted)">
                  <span>{toPersianDigits(p.stats.completed)}/{toPersianDigits(p.stats.total)} وظیفه</span>
                  <span>{p.dueDate ? formatJalaliDate(p.dueDate) : "بدون مهلت"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline">{STATUS_LABELS[p.status]}</Badge>
                  <Badge variant="outline">{PRIORITY_LABELS[p.priority]}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
