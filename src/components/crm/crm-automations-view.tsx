"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Rule = {
  id: string;
  name: string;
  triggerType: "deal_won" | "deal_stage_changed";
  actionType: "create_project_from_deal" | "create_crm_follow_up";
  config: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: string | null;
};

type Run = {
  id: string;
  ruleId: string | null;
  status: "success" | "skipped" | "failed";
  error: string | null;
  createdAt: string;
};

type Template = {
  id: string;
  name: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.";
}

export function CrmAutomationsView() {
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState("");

  const automations = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.get<{ rules: Rule[]; runs: Run[] }>("/api/automations"),
  });

  const templates = useQuery({
    queryKey: ["project-templates"],
    queryFn: () => api.get<{ templates: Template[] }>("/api/project-templates"),
  });

  const createRule = useMutation({
    mutationFn: (payload: unknown) => api.post("/api/automations", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("اتوماسیون فعال شد.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/automations/${id}`, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (automations.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>;
  }

  if (automations.isError) {
    const message = getErrorMessage(automations.error);
    return (
      <Card className="p-5">
        <p className="font-bold text-(--color-text)">اتوماسیون برای مدیران Workspace</p>
        <p className="mt-2 text-xs leading-6 text-(--color-muted)">{message}</p>
      </Card>
    );
  }

  const rules = automations.data?.rules ?? [];
  const runs = automations.data?.runs ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-extrabold text-(--color-text)">فروش موفق شد → پروژه بساز</p>
          <p className="mt-1 text-xs leading-6 text-(--color-muted)">
            وقتی فرصت فروش به مرحله برنده برسد، سامورایی پروژه اجرایی را خودکار ایجاد می‌کند.
          </p>

          <label className="mt-4 block text-[11px] font-medium text-(--color-muted)">قالب پروژه (اختیاری)</label>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-xs"
          >
            <option value="">بدون قالب، پروژه ساده بساز</option>
            {templates.data?.templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>

          <Button
            className="mt-4"
            size="sm"
            loading={createRule.isPending}
            onClick={() =>
              createRule.mutate({
                name: "ساخت خودکار پروژه بعد از فروش",
                triggerType: "deal_won",
                actionType: "create_project_from_deal",
                config: templateId ? { templateId } : {},
              })
            }
          >
            فعال‌کردن این اتوماسیون
          </Button>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-extrabold text-(--color-text)">مرحله فروش عوض شد → پیگیری بساز</p>
          <p className="mt-1 text-xs leading-6 text-(--color-muted)">
            بعد از هر جابه‌جایی فرصت در Pipeline، برای مسئول فروش یک پیگیری روز بعد ساخته می‌شود.
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="secondary"
            loading={createRule.isPending}
            onClick={() =>
              createRule.mutate({
                name: "پیگیری خودکار بعد از تغییر مرحله فروش",
                triggerType: "deal_stage_changed",
                actionType: "create_crm_follow_up",
                config: {
                  delayDays: 1,
                  activityType: "task",
                  title: "پیگیری بعدی فرصت فروش",
                },
              })
            }
          >
            فعال‌کردن این اتوماسیون
          </Button>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">قوانین فعال</p>
            <p className="text-[11px] text-(--color-muted)">می‌توانید هر قانون را بدون حذف‌کردن موقتاً خاموش کنید.</p>
          </div>
          <Badge variant="outline">{rules.length.toLocaleString("fa-IR")} قانون</Badge>
        </div>

        {rules.length === 0 ? (
          <Card className="p-5 text-center text-xs text-(--color-muted)">هنوز اتوماسیونی فعال نشده است.</Card>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <Card key={rule.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-[13px] font-bold text-(--color-text)">{rule.name}</p>
                  <p className="mt-1 text-[11px] text-(--color-muted)">
                    {rule.actionType === "create_project_from_deal"
                      ? "ساخت پروژه از فروش موفق"
                      : "ساخت پیگیری خودکار"}
                    {rule.lastRunAt ? ` · آخرین اجرا: ${new Date(rule.lastRunAt).toLocaleDateString("fa-IR")}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={rule.isActive ? "secondary" : "ghost"}
                  loading={toggleRule.isPending}
                  onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                >
                  {rule.isActive ? "فعال" : "خاموش"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {runs.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold">اجرای اخیر</p>
          <div className="space-y-2">
            {runs.slice(0, 8).map((run) => (
              <div key={run.id} className="flex items-center justify-between rounded-xl border border-(--color-border) bg-white px-3 py-2 text-xs">
                <span className="text-(--color-muted)">{new Date(run.createdAt).toLocaleString("fa-IR")}</span>
                <Badge variant={run.status === "success" ? "success" : run.status === "failed" ? "danger" : "outline"}>
                  {run.status === "success" ? "موفق" : run.status === "failed" ? "خطا" : "رد شد"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
