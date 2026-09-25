"use client";

import { use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { useTasks } from "@/hooks/use-data";
import { useUIStore } from "@/stores/ui-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { formatJalaliDate, relativeTimeFa } from "@/lib/date";
import { RISK_LEVEL_LABEL_FA } from "@/lib/risk";
import { toPersianDigits } from "@/lib/utils";
import { Plus, FolderKanban, MoreVertical, Archive, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

type ProjectDetailResponse = {
  project: { id: string; name: string; description: string | null; status: string; priority: string; progress: number; color: string | null; dueDate: string | null };
  stats: { total: number; completed: number; overdue: number };
  health: { score: number; level: "healthy" | "at_risk" | "critical"; factors: { label: string; impact: number }[] };
  members: { id: string; name: string; email: string; avatarColor: string | null; isOwner: boolean }[];
  statuses: { id: string; name: string; color: string | null; isDone: boolean; order: number }[];
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setCreateTaskOpen, setActiveTaskId } = useUIStore();

  const { data, isLoading } = useQuery({
    queryKey: ["project", id, "full"],
    queryFn: () => api.get<ProjectDetailResponse>(`/api/projects/${id}`),
  });

  const { data: tasksData, isLoading: tasksLoading } = useTasks({ projectId: id });

  async function handleArchive() {
    try {
      await api.patch(`/api/projects/${id}`, { status: "archived" });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("پروژه بایگانی شد.");
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/projects/${id}`);
      toast.success("پروژه حذف شد.");
      router.push("/app/projects");
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { project, stats, health, members, statuses } = data;
  const tasks = tasksData?.tasks ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <div className="mt-1 size-3 shrink-0 rounded-full" style={{ background: project.color ?? "#4f46e5" }} />
            <div>
              <h1 className="text-lg font-bold">{project.name}</h1>
              <p className="mt-1 max-w-lg text-sm text-(--color-muted)">{project.description || "بدون توضیح"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={health.level === "healthy" ? "success" : health.level === "at_risk" ? "warning" : "danger"}>
                  {toPersianDigits(health.score)} · {RISK_LEVEL_LABEL_FA[health.level]}
                </Badge>
                {project.dueDate && <Badge variant="outline">مهلت: {formatJalaliDate(project.dueDate)}</Badge>}
                <div className="flex -space-x-2 space-x-reverse">
                  {members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} color={m.avatarColor} size={26} className="ring-2 ring-white" />)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateTaskOpen(true)}><Plus className="size-4" /> وظیفه جدید</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="secondary"><MoreVertical className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleArchive}><Archive className="size-4" /> بایگانی پروژه</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDelete} className="text-(--color-danger)"><Trash2 className="size-4" /> حذف پروژه</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-(--color-muted)">
            <span>پیشرفت پروژه</span>
            <span>{toPersianDigits(stats.completed)}/{toPersianDigits(stats.total)} وظیفه تکمیل‌شده</span>
          </div>
          <Progress value={stats.total ? Math.round((stats.completed / stats.total) * 100) : 0} className="mt-1.5" />
        </div>
      </Card>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">تخته کانبان</TabsTrigger>
          <TabsTrigger value="list">لیست وظایف</TabsTrigger>
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          {tasksLoading ? <Skeleton className="h-96" /> : (
            <KanbanBoard statuses={statuses} tasks={tasks} projectId={id} />
          )}
        </TabsContent>

        <TabsContent value="list">
          {tasks.length === 0 ? (
            <EmptyState icon={<FolderKanban className="size-5" />} title="وظیفه‌ای ثبت نشده" description="اولین وظیفه این پروژه را ایجاد کنید." action={<Button size="sm" onClick={() => setCreateTaskOpen(true)}>ایجاد وظیفه</Button>} />
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <button key={t.id} onClick={() => setActiveTaskId(t.id)} className="flex w-full items-center gap-3 rounded-xl border border-(--color-border) bg-white p-3 text-right hover:bg-slate-50">
                  <span className="size-2 rounded-full" style={{ background: t.statusColor ?? "#94a3b8" }} />
                  <span className="flex-1 truncate text-[13px] font-medium">{t.title}</span>
                  <Badge variant="outline">{t.statusName}</Badge>
                  {t.assigneeName && <Avatar name={t.assigneeName} color={t.assigneeColor} size={24} />}
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>عوامل تأثیرگذار بر سلامت پروژه</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {health.factors.length === 0 ? (
                <p className="text-xs text-(--color-muted)">عامل منفی خاصی شناسایی نشده است.</p>
              ) : (
                health.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
                    <span>{f.label}</span>
                    <Badge variant="warning">-{toPersianDigits(f.impact)}</Badge>
                  </div>
                ))
              )}
              <p className="pt-2 text-[11px] text-slate-400">آخرین محاسبه: {relativeTimeFa(new Date())}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
