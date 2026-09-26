"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type TemplateTask = {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  dueOffsetDays: number | null;
};

type ProjectTemplate = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  defaultPriority: "critical" | "high" | "medium" | "low";
  defaultDurationDays: number | null;
  tasks: TemplateTask[];
};

function errorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد. دوباره تلاش کنید.";
}

export function ProjectTemplatesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "apply">("list");
  const [selected, setSelected] = useState<ProjectTemplate | null>(null);

  const query = useQuery({
    queryKey: ["project-templates"],
    queryFn: () => api.get<{ templates: ProjectTemplate[] }>("/api/project-templates"),
    enabled: open,
  });

  const createTemplate = useMutation({
    mutationFn: (payload: unknown) => api.post("/api/project-templates", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-templates"] });
      toast.success("قالب پروژه ساخته شد.");
      setMode("list");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const applyTemplate = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.post<{ project: { id: string; name: string } }>(`/api/project-templates/${id}/apply`, { name, memberIds: [] }),
    onSuccess: async ({ project }) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`پروژه «${project.name}» آماده شد.`);
      onOpenChange(false);
      setMode("list");
      setSelected(null);
      router.push(`/app/projects/${project.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const taskLines = String(form.get("tasks") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 100);

    if (taskLines.length === 0) {
      toast.error("حداقل یک وظیفه برای قالب بنویسید.");
      return;
    }

    const duration = Number(form.get("duration") || 0);

    createTemplate.mutate({
      name: String(form.get("name") || ""),
      description: String(form.get("description") || "") || null,
      color: "#4f46e5",
      defaultPriority: "medium",
      defaultDurationDays: duration > 0 ? duration : null,
      tasks: taskLines.map((title, index) => ({
        title,
        priority: "medium",
        dueOffsetDays: duration > 0
          ? Math.max(0, Math.round(((index + 1) / taskLines.length) * duration))
          : null,
      })),
    });
  }

  function chooseTemplate(template: ProjectTemplate) {
    setSelected(template);
    setMode("apply");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) {
          setMode("list");
          setSelected(null);
        }
      }}
    >
      <DialogContent
        title={mode === "create" ? "قالب پروژه جدید" : mode === "apply" ? "ساخت پروژه از قالب" : "قالب‌های پروژه"}
        description={
          mode === "create"
            ? "کارهای تکراری پروژه را یک‌بار تعریف کنید."
            : mode === "apply"
              ? "سامورایی پروژه و وظایف اولیه را خودکار می‌سازد."
              : "برای پروژه‌های تکراری، هر بار از صفر شروع نکنید."
        }
      >
        {mode === "list" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setMode("create")}>قالب جدید</Button>
            </div>

            {query.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (query.data?.templates.length ?? 0) === 0 ? (
              <EmptyState
                title="هنوز قالبی ندارید"
                description="مثلاً یک قالب برای اجرای پروژه مشتری یا کمپین بازاریابی بسازید."
                action={<Button size="sm" onClick={() => setMode("create")}>ساخت اولین قالب</Button>}
              />
            ) : (
              <div className="max-h-[430px] space-y-2 overflow-y-auto pl-1">
                {query.data?.templates.map((template) => (
                  <Card key={template.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-(--color-text)">{template.name}</p>
                        <p className="mt-1 text-xs text-(--color-muted)">
                          {template.tasks.length.toLocaleString("fa-IR")} وظیفه
                          {template.defaultDurationDays ? ` · ${template.defaultDurationDays.toLocaleString("fa-IR")} روز` : ""}
                        </p>
                        {template.description && (
                          <p className="mt-2 line-clamp-2 text-xs leading-6 text-(--color-muted)">{template.description}</p>
                        )}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => chooseTemplate(template)}>
                        ساخت پروژه
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={submitCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">نام قالب</label>
              <Input name="name" required placeholder="مثلاً اجرای پروژه مشتری" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">توضیح کوتاه</label>
              <Input name="description" placeholder="این قالب برای چه نوع پروژه‌ای است؟" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">مدت معمول پروژه (روز)</label>
              <Input name="duration" type="number" min="1" max="3650" placeholder="مثلاً ۳۰" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">وظایف اولیه</label>
              <Textarea
                name="tasks"
                rows={7}
                required
                placeholder={"جلسه شروع پروژه\nجمع‌آوری نیازمندی‌ها\nاجرای کار\nبازبینی داخلی\nتایید مشتری\nتحویل نهایی"}
              />
              <p className="mt-1 text-[11px] text-(--color-muted)">هر وظیفه را در یک خط بنویسید.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setMode("list")}>بازگشت</Button>
              <Button type="submit" loading={createTemplate.isPending}>ذخیره قالب</Button>
            </div>
          </form>
        )}

        {mode === "apply" && selected && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              applyTemplate.mutate({ id: selected.id, name: String(form.get("name") || selected.name) });
            }}
            className="space-y-4"
          >
            <Card className="p-4">
              <p className="font-bold">{selected.name}</p>
              <p className="mt-1 text-xs text-(--color-muted)">
                سامورایی {selected.tasks.length.toLocaleString("fa-IR")} وظیفه اولیه را همراه پروژه می‌سازد.
              </p>
            </Card>
            <div>
              <label className="mb-1 block text-xs font-medium">نام پروژه جدید</label>
              <Input name="name" required defaultValue={selected.name} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode("list")}>بازگشت</Button>
              <Button type="submit" loading={applyTemplate.isPending}>ساخت پروژه</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
