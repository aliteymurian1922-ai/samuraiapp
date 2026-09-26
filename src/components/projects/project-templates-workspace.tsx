"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type TemplateTask = {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  dueOffsetDays: number | null;
  estimatedMinutes: number | null;
  position: number;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  defaultPriority: "critical" | "high" | "medium" | "low";
  defaultDurationDays: number | null;
  tasks: TemplateTask[];
};

type Response = { templates: ProjectTemplate[] };

const PRIORITY_LABEL: Record<ProjectTemplate["defaultPriority"], string> = {
  critical: "بحرانی",
  high: "بالا",
  medium: "متوسط",
  low: "کم",
};

function errorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد. دوباره تلاش کنید.";
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: ["project-templates"],
    queryFn: () => api.get<Response>("/api/project-templates"),
  });
}

export function ProjectTemplatesWorkspace() {
  const queryClient = useQueryClient();
  const templates = useProjectTemplates();
  const [open, setOpen] = useState(false);

  const instantiate = useMutation({
    mutationFn: (id: string) =>
      api.post<{ project: { id: string; name: string } }>(`/api/project-templates/${id}/instantiate`, {}),
    onSuccess: async ({ project }) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`پروژه «${project.name}» ساخته شد.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-(--color-primary)">قالب‌های پروژه</p>
          <h1 className="mt-1 text-xl font-extrabold text-(--color-text)">پروژه‌های تکراری را از صفر نسازید</h1>
          <p className="mt-1 text-xs text-(--color-muted)">یک بار ساختار کار را تعریف کنید؛ بعد هر پروژه با Taskهای آماده شروع شود.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/projects"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-(--color-border) bg-white px-4 text-xs font-semibold text-(--color-text)"
          >
            پروژه‌ها
          </Link>
          <Button onClick={() => setOpen(true)}>قالب جدید</Button>
        </div>
      </div>

      {templates.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-48" />)}
        </div>
      ) : (templates.data?.templates.length ?? 0) === 0 ? (
        <EmptyState
          title="هنوز قالبی ندارید"
          description="مثلاً یک قالب «راه‌اندازی مشتری جدید» بسازید و کارهای ثابت آن را یک‌بار تعریف کنید."
          action={<Button size="sm" onClick={() => setOpen(true)}>ساخت اولین قالب</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.data?.templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: template.color }} />
                    <p className="truncate font-bold text-(--color-text)">{template.name}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs text-(--color-muted)">
                    {template.description || "بدون توضیح"}
                  </p>
                </div>
                <Badge variant="outline">{PRIORITY_LABEL[template.defaultPriority]}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-lg font-extrabold text-(--color-text)">{template.tasks.length.toLocaleString("fa-IR")}</p>
                  <p className="text-[10px] text-slate-400">کار آماده</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-(--color-text)">
                    {template.defaultDurationDays ? template.defaultDurationDays.toLocaleString("fa-IR") : "—"}
                  </p>
                  <p className="text-[10px] text-slate-400">روز زمان پیشنهادی</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {template.tasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-[11px] text-(--color-muted)">
                    <span className="size-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
                {template.tasks.length > 4 && (
                  <p className="text-[10px] text-slate-400">+ {(template.tasks.length - 4).toLocaleString("fa-IR")} کار دیگر</p>
                )}
              </div>

              <Button
                className="mt-4 w-full"
                variant="secondary"
                loading={instantiate.isPending}
                onClick={() => instantiate.mutate(template.id)}
              >
                ساخت پروژه از این قالب
              </Button>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ["project-templates"] });
        }}
      />
    </div>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawTasks = String(form.get("tasks") || "");

    const tasks = rawTasks
      .split("\n")
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title, index) => ({
        title,
        priority: "medium" as const,
        dueOffsetDays: index + 1,
        estimatedMinutes: null,
      }));

    try {
      setSubmitting(true);
      await api.post("/api/project-templates", {
        name: String(form.get("name") || ""),
        description: String(form.get("description") || "") || null,
        color: String(form.get("color") || "#4f46e5"),
        defaultPriority: String(form.get("priority") || "medium"),
        defaultDurationDays: form.get("duration") ? Number(form.get("duration")) : null,
        tasks,
      });
      await onCreated();
      toast.success("قالب پروژه ساخته شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="قالب پروژه جدید" description="کارهای ثابت این نوع پروژه را یک‌بار تعریف کنید.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="نام قالب"><Input name="name" required placeholder="مثلاً راه‌اندازی مشتری جدید" /></Field>
          <Field label="توضیح"><Textarea name="description" rows={2} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="اولویت">
              <NativeSelect name="priority" defaultValue="medium">
                <option value="critical">بحرانی</option>
                <option value="high">بالا</option>
                <option value="medium">متوسط</option>
                <option value="low">کم</option>
              </NativeSelect>
            </Field>
            <Field label="مدت پیشنهادی">
              <Input name="duration" type="number" min="1" max="365" placeholder="روز" />
            </Field>
            <Field label="رنگ">
              <Input name="color" type="color" defaultValue="#4f46e5" className="px-1" />
            </Field>
          </div>
          <Field label="کارهای اولیه">
            <Textarea
              name="tasks"
              rows={7}
              placeholder={"هر کار را در یک خط بنویسید\nجلسه شروع پروژه\nجمع‌آوری اطلاعات\nاجرای مرحله اول\nبازبینی و تحویل"}
            />
          </Field>
          <p className="text-[11px] text-(--color-muted)">هر خط به یک Task تبدیل می‌شود و موعدها به‌ترتیب روزهای پروژه تنظیم می‌شوند.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ساخت قالب</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-(--color-text)">{label}</span>
      {children}
    </label>
  );
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm text-(--color-text) focus:border-(--color-primary) focus:ring-2 focus:ring-indigo-100 ${props.className ?? ""}`}
    />
  );
}
