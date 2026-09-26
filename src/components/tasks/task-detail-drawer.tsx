"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus, Play, Square, Check } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useTask, useMembers } from "@/hooks/use-data";
import { useProjectStatuses } from "@/hooks/use-data";
import { api, ClientApiError } from "@/lib/api-client";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatJalaliDate, relativeTimeFa } from "@/lib/date";

const PRIORITY_LABELS: Record<string, string> = { critical: "بحرانی", high: "بالا", medium: "متوسط", low: "پایین" };
const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "primary" | "default"> = {
  critical: "danger", high: "warning", medium: "primary", low: "default",
};

type TaskRecurrence = {
  id: string;
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  endAt: string | null;
  occurrencesCreated: number;
  isActive: boolean;
};

const RECURRENCE_LABELS: Record<TaskRecurrence["frequency"], string> = {
  daily: "هر روز",
  weekly: "هر هفته",
  monthly: "هر ماه",
};

export function TaskDetailDrawer() {
  const { activeTaskId, setActiveTaskId } = useUIStore();
  const open = Boolean(activeTaskId);

  return (
    <Drawer open={open} onOpenChange={(v) => !v && setActiveTaskId(null)}>
      {open && <DrawerContent>{activeTaskId && <TaskDetailBody taskId={activeTaskId} />}</DrawerContent>}
    </Drawer>
  );
}

function TaskDetailBody({ taskId }: { taskId: string }) {
  const { data, isLoading } = useTask(taskId);
  const { data: membersData } = useMembers();
  const queryClient = useQueryClient();
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const task = data?.task;
  const { data: statusesData } = useProjectStatuses(task?.projectId);
  const recurrenceQuery = useQuery({
    queryKey: ["task-recurrence", taskId],
    queryFn: () => api.get<{ recurrence: TaskRecurrence | null }>(`/api/tasks/${taskId}/recurrence`),
  });
  const recurrence = recurrenceQuery.data?.recurrence ?? null;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["task-recurrence", taskId] });
  }

  async function patchTask(payload: Record<string, unknown>) {
    try {
      await api.patch(`/api/tasks/${taskId}`, payload);
      invalidate();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  function onDescriptionChange(value: string) {
    setSavingState("saving");
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(async () => {
      await patchTask({ description: value });
      setSavingState("saved");
      setTimeout(() => setSavingState("idle"), 1500);
    }, 800);
  }

  async function toggleDone() {
    if (!task) return;
    await patchTask({ completed: !task.statusIsDone });
  }

  async function deleteTask() {
    if (!task) return;
    try {
      await api.delete(`/api/tasks/${taskId}`);
      invalidate();
      useUIStore.getState().setActiveTaskId(null);
      toast("وظیفه حذف شد.", {
        action: {
          label: "بازگردانی",
          onClick: async () => {
            await api.post(`/api/tasks/${taskId}/restore`);
            invalidate();
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  async function addChecklistItem() {
    if (!newChecklistItem.trim()) return;
    try {
      await api.post(`/api/tasks/${taskId}/checklist`, { title: newChecklistItem.trim() });
      setNewChecklistItem("");
      invalidate();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  async function toggleChecklistItem(id: string, isDone: boolean) {
    await api.patch(`/api/tasks/${taskId}/checklist/${id}`, { isDone });
    invalidate();
  }

  async function removeChecklistItem(id: string) {
    await api.delete(`/api/tasks/${taskId}/checklist/${id}`);
    invalidate();
  }

  async function addComment() {
    if (!newComment.trim()) return;
    try {
      await api.post(`/api/tasks/${taskId}/comments`, { body: newComment.trim() });
      setNewComment("");
      invalidate();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  const runningEntry = task?.timeEntries.find((e) => !e.endedAt);

  async function toggleTimer() {
    try {
      if (runningEntry) {
        await api.post(`/api/tasks/${taskId}/time`, { action: "stop", entryId: runningEntry.id });
      } else {
        await api.post(`/api/tasks/${taskId}/time`, { action: "start" });
      }
      invalidate();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  async function updateRecurrence(value: string) {
    try {
      if (value === "none") {
        await api.delete(`/api/tasks/${taskId}/recurrence`);
        toast.success("تکرار وظیفه متوقف شد.");
      } else {
        await api.post(`/api/tasks/${taskId}/recurrence`, {
          frequency: value,
          interval: 1,
          endAt: null,
          isActive: true,
        });
        toast.success(`وظیفه روی «${RECURRENCE_LABELS[value as TaskRecurrence["frequency"]]}» تنظیم شد.`);
      }
      queryClient.invalidateQueries({ queryKey: ["task-recurrence", taskId] });
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "تنظیم تکرار انجام نشد.");
    }
  }

  if (isLoading || !task) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const checklistDone = task.checklist.filter((c) => c.isDone).length;
  const unresolvedBlockers = task.dependencies.filter((dependency) => dependency.type === "blocked_by" && !dependency.isDone);
  const members = membersData?.members ?? [];
  const statuses = statusesData?.statuses ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-(--color-border) bg-white px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Checkbox checked={task.statusIsDone} onCheckedChange={toggleDone} />
          <Badge variant={PRIORITY_VARIANT[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
          {unresolvedBlockers.length > 0 && (
            <Badge variant="danger">مسدود · {unresolvedBlockers.length.toLocaleString("fa-IR")}</Badge>
          )}
          <span className="text-xs text-(--color-muted)">{task.projectName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={deleteTask} aria-label="حذف وظیفه">
            <Trash2 className="size-4 text-(--color-danger)" />
          </Button>
          <DrawerClose />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <input
          defaultValue={task.title}
          onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && patchTask({ title: e.target.value.trim() })}
          className="w-full border-none bg-transparent text-lg font-bold text-(--color-text) outline-none"
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <FieldBlock label="وضعیت">
            <Select value={task.statusId} onValueChange={(v) => patchTask({ statusId: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldBlock>
          <FieldBlock label="اولویت">
            <Select value={task.priority} onValueChange={(v) => patchTask({ priority: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldBlock>
          <FieldBlock label="مسئول">
            <Select value={task.assigneeId ?? "none"} onValueChange={(v) => patchTask({ assigneeId: v === "none" ? null : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="بدون مسئول" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون مسئول</SelectItem>
                {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldBlock>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-white px-3 py-2.5">
          <div className="text-xs text-(--color-muted)">
            <span className="font-medium text-(--color-text)">زمان صرف‌شده: </span>
            {Math.round((task.timeEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0)) / 6) / 10} ساعت
          </div>
          <Button size="sm" variant={runningEntry ? "danger" : "secondary"} onClick={toggleTimer}>
            {runningEntry ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
            {runningEntry ? "توقف تایمر" : "شروع تایمر"}
          </Button>
        </div>

        <div className="mt-5">
          <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-(--color-muted)">
            توضیحات
            {savingState === "saving" && <span>در حال ذخیره...</span>}
            {savingState === "saved" && <span className="text-(--color-success)">ذخیره شد</span>}
          </p>
          <Textarea key={task.id} rows={4} defaultValue={task.description ?? ""} onChange={(e) => onDescriptionChange(e.target.value)} placeholder="توضیحی برای این وظیفه بنویسید..." />
        </div>

        <div className="mt-5">
          <p className="mb-2 flex items-center justify-between text-xs font-semibold text-(--color-muted)">
            <span>چک‌لیست {task.checklist.length > 0 && `(${checklistDone}/${task.checklist.length})`}</span>
          </p>
          {task.checklist.length > 0 && (
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-(--color-success)" style={{ width: `${(checklistDone / task.checklist.length) * 100}%` }} />
            </div>
          )}
          <div className="space-y-1.5">
            {task.checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                <Checkbox checked={item.isDone} onCheckedChange={(v) => toggleChecklistItem(item.id, Boolean(v))} />
                <span className={`flex-1 text-[13px] ${item.isDone ? "text-slate-400 line-through" : "text-(--color-text)"}`}>{item.title}</span>
                <button onClick={() => removeChecklistItem(item.id)} className="opacity-0 transition group-hover:opacity-100">
                  <Trash2 className="size-3.5 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="افزودن مورد چک‌لیست..." value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChecklistItem()} />
            <Button size="icon" variant="secondary" onClick={addChecklistItem}><Plus className="size-4" /></Button>
          </div>
        </div>

        {task.subtasks.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-(--color-muted)">زیروظیفه‌ها ({task.subtasks.filter((s) => s.statusIsDone).length}/{task.subtasks.length})</p>
            <div className="space-y-1.5">
              {task.subtasks.map((s) => (
                <button key={s.id} onClick={() => useUIStore.getState().setActiveTaskId(s.id)} className="flex w-full items-center gap-2 rounded-lg border border-(--color-border) bg-white px-2.5 py-2 text-right text-[13px] hover:bg-slate-50">
                  {s.statusIsDone ? <Check className="size-3.5 text-(--color-success)" /> : <span className="size-3.5 rounded-full border border-slate-300" />}
                  <span className="flex-1 truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {task.dependencies.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-(--color-muted)">وابستگی‌ها</p>
            <div className="space-y-1.5">
              {task.dependencies.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-white px-2.5 py-2 text-[13px]">
                  <Badge variant={d.isDone ? "success" : "warning"}>{d.type === "blocked_by" ? "وابسته به" : "مسدودکننده"}</Badge>
                  <span className="flex-1 truncate">{d.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-(--color-muted)">نظرات ({task.comments.length})</p>
          <div className="space-y-3">
            {task.comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar name={c.authorName ?? "?"} color={c.authorColor} size={28} />
                <div className="flex-1 rounded-xl bg-white p-2.5 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.authorName}</span>
                    <span className="text-[11px] text-slate-400">{relativeTimeFa(c.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-(--color-text)">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="نظر خود را بنویسید... (@نام برای منشن)" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} />
            <Button variant="secondary" onClick={addComment}>ارسال</Button>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-slate-400">
          ایجاد شده: {formatJalaliDate(task.createdAt)} · آخرین به‌روزرسانی: {relativeTimeFa(task.createdAt)}
        </p>
      </div>
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-(--color-muted)">{label}</p>
      {children}
    </div>
  );
}
