"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useTasks, useProjects, useMembers, useProjectStatuses } from "@/hooks/use-data";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const PRIORITY_LABELS: Record<string, string> = { critical: "بحرانی", high: "بالا", medium: "متوسط", low: "پایین" };

type TaskSavedView = {
  id: string;
  name: string;
  filters: {
    search?: string;
    projectId?: string;
    assigneeId?: string;
    priority?: "critical" | "high" | "medium" | "low";
    overdue?: boolean;
  };
  isDefault: boolean;
};

function TasksPageInner() {
  const searchParams = useSearchParams();
  const { setCreateTaskOpen, setActiveTaskId } = useUIStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState<string>("all");
  const [assigneeId, setAssigneeId] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [savingView, setSavingView] = useState(false);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);

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
  const { data: savedViewsData } = useQuery({
    queryKey: ["task-saved-views"],
    queryFn: () => api.get<{ views: TaskSavedView[] }>("/api/task-views"),
  });

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedIds.has(task.id)),
    [tasks, selectedIds],
  );
  const selectedProjectIds = useMemo(
    () => [...new Set(selectedTasks.map((task) => task.projectId))],
    [selectedTasks],
  );
  const selectedProjectId = selectedProjectIds.length === 1 ? selectedProjectIds[0] : undefined;
  const { data: selectedProjectStatuses } = useProjectStatuses(selectedProjectId);


  async function toggleComplete(taskId: string, completed: boolean) {
    try {
      await api.patch(`/api/tasks/${taskId}`, { completed });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "تغییر وضعیت وظیفه انجام نشد.");
    }
  }

  function toggleSelection(taskId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(tasks.map((task) => task.id)));
  }

  async function runBulkAction(payload: Record<string, unknown>, successMessage: string) {
    if (selectedIds.size === 0) return;
    try {
      setBulkPending(true);
      await api.post("/api/tasks/bulk", {
        ...payload,
        taskIds: [...selectedIds],
      });
      setSelectedIds(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["team-report"] }),
      ]);
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "عملیات گروهی انجام نشد.");
    } finally {
      setBulkPending(false);
    }
  }

  function markFiltersChanged() {
    setActiveSavedViewId(null);
    setSelectedIds(new Set());
  }

  function applySavedView(view: TaskSavedView) {
    setSearch(view.filters.search ?? "");
    setProjectId(view.filters.projectId ?? "all");
    setAssigneeId(view.filters.assigneeId ?? "all");
    setPriority(view.filters.priority ?? "all");
    setOnlyOverdue(Boolean(view.filters.overdue));
    setSelectedIds(new Set());
    setActiveSavedViewId(view.id);
  }

  async function saveCurrentView() {
    const name = viewName.trim();
    if (name.length < 2) {
      toast.error("یک نام کوتاه برای این View وارد کنید.");
      return;
    }

    try {
      setSavingView(true);
      const filters = {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(projectId !== "all" ? { projectId } : {}),
        ...(assigneeId !== "all" ? { assigneeId } : {}),
        ...(priority !== "all" ? { priority } : {}),
        ...(onlyOverdue ? { overdue: true } : {}),
      };

      const response = await api.post<{ view: TaskSavedView }>("/api/task-views", {
        name,
        filters,
        isDefault: false,
      });

      await queryClient.invalidateQueries({ queryKey: ["task-saved-views"] });
      setActiveSavedViewId(response.view.id);
      setViewName("");
      setSaveViewOpen(false);
      toast.success("نمای فیلتر ذخیره شد.");
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "ذخیره View انجام نشد.");
    } finally {
      setSavingView(false);
    }
  }

  async function deleteSavedView(viewId: string) {
    try {
      await api.delete(`/api/task-views/${viewId}`);
      if (activeSavedViewId === viewId) setActiveSavedViewId(null);
      await queryClient.invalidateQueries({ queryKey: ["task-saved-views"] });
      toast.success("View حذف شد.");
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "حذف View انجام نشد.");
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
          <Input
            placeholder="جستجوی وظیفه..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              markFiltersChanged();
            }}
            className="pr-9"
          />
        </div>
        <Select value={projectId} onValueChange={(value) => { setProjectId(value); markFiltersChanged(); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="پروژه" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه پروژه‌ها</SelectItem>
            {(projectsData?.projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigneeId} onValueChange={(value) => { setAssigneeId(value); markFiltersChanged(); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="مسئول" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه اعضا</SelectItem>
            {(membersData?.members ?? []).map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(value) => { setPriority(value); markFiltersChanged(); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="اولویت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه اولویت‌ها</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          onClick={() => { setOnlyOverdue((v) => !v); markFiltersChanged(); }}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${onlyOverdue ? "bg-(--color-danger) text-white" : "border border-(--color-border) bg-white text-(--color-muted)"}`}
        >
          فقط عقب‌افتاده
        </button>
        <Button size="sm" variant="secondary" onClick={() => setSaveViewOpen(true)}>
          ذخیره این نما
        </Button>
      </div>

      {(savedViewsData?.views.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-(--color-muted)">نماهای ذخیره‌شده:</span>
          {savedViewsData?.views.map((view) => (
            <div
              key={view.id}
              className={`inline-flex items-center overflow-hidden rounded-xl border text-xs transition ${activeSavedViewId === view.id ? "border-(--color-primary) bg-(--color-primary-soft)" : "border-(--color-border) bg-white"}`}
            >
              <button
                type="button"
                onClick={() => applySavedView(view)}
                className="px-3 py-2 font-medium text-(--color-text) hover:bg-slate-50"
              >
                {view.name}
              </button>
              <button
                type="button"
                onClick={() => deleteSavedView(view.id)}
                className="border-r border-(--color-border) px-2 py-2 text-slate-400 hover:bg-red-50 hover:text-(--color-danger)"
                aria-label={`حذف View ${view.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="rounded-2xl border border-(--color-primary)/20 bg-(--color-primary-soft) p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-(--color-text)">
                {selectedIds.size.toLocaleString("fa-IR")} وظیفه انتخاب شده
              </span>
              {selectedIds.size < tasks.length && (
                <button
                  type="button"
                  className="font-semibold text-(--color-primary)"
                  onClick={selectAllVisible}
                >
                  انتخاب همه نتایج ({tasks.length.toLocaleString("fa-IR")})
                </button>
              )}
              <button
                type="button"
                className="text-(--color-muted)"
                onClick={() => setSelectedIds(new Set())}
              >
                پاک کردن انتخاب
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                disabled={bulkPending}
                onValueChange={(value) =>
                  runBulkAction(
                    { action: "assign", assigneeId: value === "none" ? null : value },
                    "مسئول وظایف تغییر کرد.",
                  )
                }
              >
                <SelectTrigger className="h-9 w-36 bg-white"><SelectValue placeholder="تغییر مسئول" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مسئول</SelectItem>
                  {(membersData?.members ?? []).map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                disabled={bulkPending}
                onValueChange={(value) =>
                  runBulkAction({ action: "priority", priority: value }, "اولویت وظایف تغییر کرد.")
                }
              >
                <SelectTrigger className="h-9 w-32 bg-white"><SelectValue placeholder="اولویت" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProjectId && (
                <Select
                  disabled={bulkPending}
                  onValueChange={(statusId) =>
                    runBulkAction({ action: "status", statusId }, "وضعیت وظایف تغییر کرد.")
                  }
                >
                  <SelectTrigger className="h-9 w-36 bg-white"><SelectValue placeholder="تغییر وضعیت" /></SelectTrigger>
                  <SelectContent>
                    {(selectedProjectStatuses?.statuses ?? []).map((status) => (
                      <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                size="sm"
                variant="secondary"
                loading={bulkPending}
                onClick={() => runBulkAction({ action: "complete" }, "وظایف تکمیل شدند.")}
              >
                تکمیل
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={bulkPending}
                onClick={() => runBulkAction({ action: "reopen" }, "وظایف دوباره باز شدند.")}
              >
                بازکردن
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={bulkPending}
                onClick={() => runBulkAction({ action: "delete" }, "وظایف حذف شدند.")}
              >
                حذف
              </Button>
            </div>
          </div>

          {!selectedProjectId && selectedProjectIds.length > 1 && (
            <p className="mt-2 text-[11px] text-(--color-muted)">
              برای تغییر ستون وضعیت، فقط وظایف یک پروژه را انتخاب کنید.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-6" />} title="وظیفه‌ای یافت نشد" description="فیلتر را تغییر دهید یا اولین وظیفه را ایجاد کنید." action={<Button size="sm" onClick={() => setCreateTaskOpen(true)}>ایجاد وظیفه</Button>} />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const overdue = t.dueDate && !t.statusIsDone && new Date(t.dueDate).getTime() < new Date().getTime();
            return (
              <div key={t.id} className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${selectedIds.has(t.id) ? "border-(--color-primary) ring-1 ring-(--color-primary)/10" : "border-(--color-border)"}`}>
                <Checkbox
                  checked={selectedIds.has(t.id)}
                  onCheckedChange={(value) => toggleSelection(t.id, Boolean(value))}
                  aria-label="انتخاب وظیفه برای عملیات گروهی"
                />
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

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent
          title="ذخیره نمای وظایف"
          description="فیلترهای فعلی با این نام ذخیره می‌شوند و فقط برای حساب شما قابل مشاهده‌اند."
        >
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-(--color-text)">نام View</p>
              <Input
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder="مثلاً کارهای فوری من"
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveCurrentView();
                }}
              />
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-(--color-muted)">
              <p>
                پروژه: {projectId === "all" ? "همه" : projectsData?.projects.find((project) => project.id === projectId)?.name ?? "انتخاب‌شده"}
                {" · "}
                مسئول: {assigneeId === "all" ? "همه" : membersData?.members.find((member) => member.userId === assigneeId)?.name ?? "انتخاب‌شده"}
              </p>
              <p className="mt-1">
                اولویت: {priority === "all" ? "همه" : PRIORITY_LABELS[priority]}
                {onlyOverdue ? " · فقط عقب‌افتاده" : ""}
                {search.trim() ? ` · جستجو: «${search.trim()}»` : ""}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSaveViewOpen(false)}>انصراف</Button>
              <Button loading={savingView} onClick={saveCurrentView}>ذخیره View</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
