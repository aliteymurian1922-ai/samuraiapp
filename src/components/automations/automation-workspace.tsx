"use client";

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
import { formatJalaliDate } from "@/lib/date";

type Trigger =
  | "lead_created"
  | "lead_status_changed"
  | "deal_created"
  | "deal_stage_changed"
  | "deal_won"
  | "deal_lost";

type Action = "create_follow_up" | "create_project" | "notify_owner";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  trigger: Trigger;
  action: Action;
  conditions: Record<string, unknown>;
  actionConfig: Record<string, unknown>;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
};

type Run = {
  id: string;
  ruleId: string;
  entityType: string;
  entityId: string | null;
  status: "success" | "failed" | "skipped";
  message: string | null;
  createdAt: string;
};

type AutomationResponse = { rules: Rule[]; runs: Run[] };

type ProjectTemplateOption = {
  id: string;
  name: string;
  tasks: { id: string; title: string }[];
};

type ProjectTemplatesResponse = {
  templates: ProjectTemplateOption[];
};

const TRIGGER_LABELS: Record<Trigger, string> = {
  lead_created: "وقتی سرنخ جدید ثبت شد",
  lead_status_changed: "وقتی وضعیت سرنخ تغییر کرد",
  deal_created: "وقتی فرصت فروش ایجاد شد",
  deal_stage_changed: "وقتی مرحله فروش تغییر کرد",
  deal_won: "وقتی فروش برنده شد",
  deal_lost: "وقتی فروش از دست رفت",
};

const ACTION_LABELS: Record<Action, string> = {
  create_follow_up: "ساخت پیگیری خودکار",
  create_project: "ساخت پروژه اجرایی",
  notify_owner: "ارسال اعلان به مسئول",
};

function getErrorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد. دوباره تلاش کنید.";
}

export function AutomationWorkspace() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.get<AutomationResponse>("/api/automations"),
  });

  const projectTemplates = useQuery({
    queryKey: ["project-templates"],
    queryFn: () => api.get<ProjectTemplatesResponse>("/api/project-templates"),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<{ rule: Rule }>(`/api/automations/${id}`, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading) {
    return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  }

  const rules = query.data?.rules ?? [];
  const runs = query.data?.runs ?? [];
  const activeCount = rules.filter((rule) => rule.isActive).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-(--color-primary)">اتوماسیون سامورایی</p>
          <h1 className="mt-1 text-xl font-extrabold text-(--color-text)">کارهای تکراری را به سامورایی بسپارید</h1>
          <p className="mt-1 text-xs text-(--color-muted)">یک اتفاق در فروش رخ می‌دهد، سامورایی اقدام بعدی را خودکار انجام می‌دهد.</p>
        </div>
        <Button onClick={() => setOpen(true)}>اتوماسیون جدید</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="اتوماسیون فعال" value={activeCount} />
        <Metric label="کل قوانین" value={rules.length} />
        <Metric label="اجراهای اخیر" value={runs.length} />
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="هنوز اتوماسیونی نساخته‌اید"
          description="مثلاً مشخص کنید بعد از ثبت سرنخ، یک پیگیری برای مسئول فروش ساخته شود."
          action={<Button size="sm" onClick={() => setOpen(true)}>ساخت اولین اتوماسیون</Button>}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-(--color-text)">{rule.name}</p>
                    <Badge variant={rule.isActive ? "success" : "outline"}>{rule.isActive ? "فعال" : "متوقف"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-(--color-muted)">{rule.description || "بدون توضیح"}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={toggleRule.isPending}
                  onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                >
                  {rule.isActive ? "توقف" : "فعال‌سازی"}
                </Button>
              </div>

              <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-slate-400">وقتی</p>
                  <p className="mt-1 font-semibold text-(--color-text)">{TRIGGER_LABELS[rule.trigger]}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">سامورایی انجام دهد</p>
                  <p className="mt-1 font-semibold text-(--color-text)">{ACTION_LABELS[rule.action]}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>{rule.runCount.toLocaleString("fa-IR")} بار اجرا شده</span>
                <span>{rule.lastRunAt ? `آخرین اجرا: ${formatJalaliDate(rule.lastRunAt)}` : "هنوز اجرا نشده"}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4">
        <div className="mb-3">
          <p className="font-bold text-(--color-text)">تاریخچه اجرا</p>
          <p className="mt-1 text-xs text-(--color-muted)">برای اینکه همیشه بدانید سامورایی چه کاری را خودکار انجام داده است.</p>
        </div>

        {runs.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">هنوز هیچ اتوماسیونی اجرا نشده است.</p>
        ) : (
          <div className="divide-y divide-(--color-border)">
            {runs.slice(0, 20).map((run) => (
              <div key={run.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-(--color-text)">{run.message || "اجرای اتوماسیون"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{formatJalaliDate(run.createdAt, true)}</p>
                </div>
                <Badge variant={run.status === "success" ? "success" : run.status === "failed" ? "danger" : "outline"}>
                  {run.status === "success" ? "موفق" : run.status === "failed" ? "ناموفق" : "رد شد"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <CreateAutomationDialog
        open={open}
        onOpenChange={setOpen}
        templates={projectTemplates.data?.templates ?? []}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ["automations"] });
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] text-(--color-muted)">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-(--color-text)">{value.toLocaleString("fa-IR")}</p>
    </Card>
  );
}

function CreateAutomationDialog({
  open,
  onOpenChange,
  templates,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ProjectTemplateOption[];
  onCreated: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<Action>("create_follow_up");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trigger = String(form.get("trigger")) as Trigger;
    const selectedAction = String(form.get("action")) as Action;
    const dueInDays = Math.max(0, Number(form.get("dueInDays") || 1));

    const actionConfig: Record<string, unknown> = {};

    if (selectedAction === "create_follow_up") {
      actionConfig.title = String(form.get("followUpTitle") || "پیگیری خودکار");
      actionConfig.dueInDays = dueInDays;
    }

    if (selectedAction === "notify_owner") {
      actionConfig.title = String(form.get("notificationTitle") || "سامورایی: اقدام لازم است");
    }

    if (selectedAction === "create_project") {
      actionConfig.priority = String(form.get("projectPriority") || "medium");
      const templateId = String(form.get("templateId") || "");
      if (templateId) actionConfig.templateId = templateId;
    }

    try {
      setSubmitting(true);
      await api.post("/api/automations", {
        name: String(form.get("name") || ""),
        description: String(form.get("description") || "") || null,
        trigger,
        action: selectedAction,
        conditions: {},
        actionConfig,
        isActive: true,
      });
      await onCreated();
      toast.success("اتوماسیون ساخته شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="اتوماسیون جدید" description="یک اتفاق را انتخاب کنید و مشخص کنید سامورایی بعد از آن چه کاری انجام دهد.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="نام اتوماسیون">
            <Input name="name" required placeholder="مثلاً پیگیری خودکار سرنخ جدید" />
          </Field>

          <Field label="وقتی این اتفاق افتاد">
            <NativeSelect name="trigger" defaultValue="lead_created">
              {Object.entries(TRIGGER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>

          <Field label="این کار انجام شود">
            <NativeSelect name="action" value={action} onChange={(event) => setAction(event.target.value as Action)}>
              {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>

          {action === "create_follow_up" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="عنوان پیگیری"><Input name="followUpTitle" defaultValue="پیگیری خودکار" /></Field>
              <Field label="چند روز بعد؟"><Input name="dueInDays" type="number" min="0" max="365" defaultValue="1" /></Field>
            </div>
          )}

          {action === "notify_owner" && (
            <Field label="عنوان اعلان"><Input name="notificationTitle" defaultValue="سامورایی: اقدام لازم است" /></Field>
          )}

          {action === "create_project" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="قالب پروژه">
                <NativeSelect name="templateId" defaultValue="">
                  <option value="">پروژه ساده بدون قالب</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {template.tasks.length.toLocaleString("fa-IR")} کار
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="اولویت پروژه">
                <NativeSelect name="projectPriority" defaultValue="medium">
                  <option value="critical">بحرانی</option>
                  <option value="high">زیاد</option>
                  <option value="medium">متوسط</option>
                  <option value="low">کم</option>
                </NativeSelect>
              </Field>
            </div>
          )}

          <Field label="توضیح">
            <Textarea name="description" rows={2} placeholder="این اتوماسیون چه کاری را از دوش تیم برمی‌دارد؟" />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ساخت اتوماسیون</Button>
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
