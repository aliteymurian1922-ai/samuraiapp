"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useTasks, useProjects, useMembers } from "@/hooks/use-data";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatJalaliDate } from "@/lib/date";
import { Plus, ListChecks, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { api, ClientApiError } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

const PRIORITY_LABELS: Record<string, string> = { critical: "بحرانی", high: "بالا", medium: "متوسط", low: "پایین" };

function TasksPageInner() {
  const searchParams = useSearchParams();
  const { setCreateTaskOpen, setActiveTaskId } = useUIStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState<string>("all");
  const [assigneeId, setAssigneeId] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (taskId) setActiveTaskId(taskId);
  }, [searchParams, setActiveTaskId]);

  const { data, isLoading } = useTasks({
    search: search || undefined,
    projectId: projectId !== "all" ? projectId : undefined,
    assigneeId: assigneeId !== "all" ? assigneeId : undefined,
    priority: priority !== "all" ? priority : undefined,
    overdue: onlyOverdue ? "1" : undefined,
  });
  const { data: projectsData } = useProjects();
  const { data: membersData } = useMembers();

  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  async function toggleComplete(taskId: string, completed: boolean) {
    try {
      await api.patch(`/api/tasks/${taskId}`, { completed });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "تغییر وضعیت وظیفه انجام نشد.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold">وظایف</h1>
          <p className="text-xs text-(--color-muted)">همه وظایف Workspace در یک نگاه</p>
        </div>
        <Button onClick={() => setCreateTaskOpen(true)}><Plus className="size-4" /> وظیفه جدید</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="جستجوی وظیفه..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-40"><SelectValue placeholder="پروژه" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه پروژه‌ها</SelectItem>
            {(projectsData?.projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="w-36"><SelectValue placeholder="مسئول" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه اعضا</SelectItem>
            {(membersData?.members ?? []).map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-32"><SelectValue placeholder="اولویت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه اولویت‌ها</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          onClick={() => setOnlyOverdue((v) => !v)}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${onlyOverdue ? "bg-(--color-danger) text-white" : "border border-(--color-border) bg-white text-(--color-muted)"}`}
        >
          فقط عقب‌افتاده
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-6" />} title="وظیفه‌ای یافت نشد" description="فیلتر را تغییر دهید یا اولین وظیفه را ایجاد کنید." action={<Button size="sm" onClick={() => setCreateTaskOpen(true)}>ایجاد وظیفه</Button>} />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const overdue = t.dueDate && !t.statusIsDone && new Date(t.dueDate).getTime() < new Date().getTime();
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-white p-3">
                <Checkbox checked={t.statusIsDone} onCheckedChange={(v) => toggleComplete(t.id, Boolean(v))} />
                <button onClick={() => setActiveTaskId(t.id)} className="min-w-0 flex-1 text-right">
                  <p className={`truncate text-[13px] font-medium ${t.statusIsDone ? "text-slate-400 line-through" : "text-(--color-text)"}`}>{t.title}</p>
                  <p className="text-[11px] text-(--color-muted)">{t.projectName}</p>
                </button>
                <Badge variant={t.priority === "critical" ? "danger" : t.priority === "high" ? "warning" : "outline"}>{PRIORITY_LABELS[t.priority]}</Badge>
                {t.dueDate && <Badge variant={overdue ? "danger" : "outline"}>{formatJalaliDate(t.dueDate)}</Badge>}
                {t.assigneeName ? <Avatar name={t.assigneeName} color={t.assigneeColor} size={26} /> : <span className="size-6" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksPageInner />
    </Suspense>
  );
}
