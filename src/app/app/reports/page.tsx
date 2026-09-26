"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useProjects } from "@/hooks/use-data";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { toPersianDigits } from "@/lib/utils";
import { RISK_LEVEL_LABEL_FA } from "@/lib/risk";
import { WORKLOAD_LABEL_FA } from "@/lib/workload";
import type { ManagementReport } from "@/server/reports";
import { BarChart3, FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold">گزارش‌ها</h1>
        <p className="text-xs text-(--color-muted)">تحلیل عملکرد پروژه، تیم و مدیریت — همه بر پایه داده واقعی</p>
      </div>

      <Tabs defaultValue="management">
        <TabsList>
          <TabsTrigger value="management">گزارش مدیریتی</TabsTrigger>
          <TabsTrigger value="project">گزارش پروژه</TabsTrigger>
          <TabsTrigger value="team">گزارش تیم</TabsTrigger>
        </TabsList>

        <TabsContent value="management"><ManagementReportTab /></TabsContent>
        <TabsContent value="project"><ProjectReportTab /></TabsContent>
        <TabsContent value="team"><TeamReportTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ManagementReportTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-management"],
    queryFn: () => api.get<{ report: ManagementReport }>("/api/reports/management"),
  });

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const r = data.report;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-(--color-muted)">وضعیت کلی Workspace · تولید شده در {r.generatedAt}</p>
            <p className="mt-1 text-lg font-bold">{RISK_LEVEL_LABEL_FA[r.overallHealth]}</p>
          </div>
          <Badge variant={r.overallHealth === "healthy" ? "success" : r.overallHealth === "at_risk" ? "warning" : "danger"} className="text-sm">
            {r.overallHealthLabel}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="پروژه‌ها" value={r.kpis.totalProjects} />
          <Kpi label="فعال" value={r.kpis.activeProjects} />
          <Kpi label="نرخ تکمیل" value={r.kpis.completionRate} suffix="%" />
          <Kpi label="نرخ تأخیر" value={r.kpis.overdueRate} suffix="%" />
          <Kpi label="اعضا" value={r.kpis.teamMembers} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReportListCard title="دستاوردها" items={r.achievements} empty="دستاورد خاصی ثبت نشده است." />
        <ReportListCard title="مشکلات" items={r.problems} empty="مشکل بحرانی شناسایی نشده است." tone="danger" />
        <ReportListCard title="ریسک‌ها" items={r.risks} empty="ریسک قابل‌توجهی شناسایی نشده است." tone="warning" />
        <ReportListCard title="پیشنهادهای عملی" items={r.recommendations} empty="در حال حاضر پیشنهاد خاصی وجود ندارد." tone="primary" />
      </div>

      <Card>
        <CardHeader><CardTitle>عملکرد پروژه‌ها</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {r.projectPerformance.map((p) => (
            <div key={p.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
              <span>{p.name}</span>
              <Badge variant={p.level === "healthy" ? "success" : p.level === "at_risk" ? "warning" : "danger"}>{toPersianDigits(p.score)} · {p.levelLabel}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>اولویت‌های هفته آینده</CardTitle></CardHeader>
        <CardContent>
          {r.nextWeekPriorities.length === 0 ? (
            <p className="text-xs text-(--color-muted)">اولویت فوری خاصی شناسایی نشد.</p>
          ) : (
            <ol className="list-inside list-decimal space-y-1.5 text-[13px]">
              {r.nextWeekPriorities.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-lg font-extrabold text-(--color-text)">{toPersianDigits(value)}{suffix}</p>
      <p className="text-[11px] text-(--color-muted)">{label}</p>
    </div>
  );
}

function ReportListCard({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone?: "danger" | "warning" | "primary" }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-(--color-muted)">{empty}</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-[13px] ${tone === "danger" ? "bg-(--color-danger-soft) text-(--color-danger)" : tone === "warning" ? "bg-(--color-warning-soft) text-(--color-warning)" : tone === "primary" ? "bg-(--color-primary-soft) text-(--color-primary)" : "bg-slate-50 text-(--color-text)"}`}>
              {item}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ProjectReportTab() {
  const { data: projectsData } = useProjects();
  const [projectId, setProjectId] = useState<string | undefined>();
  const projects = projectsData?.projects ?? [];
  const activeId = projectId ?? projects[0]?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["report-project", activeId],
    queryFn: () => api.get<{ stats: { total: number; completed: number; overdue: number }; health: { score: number; level: string }; byPriority: Record<string, number>; byStatus: Record<string, number> }>(`/api/reports/project/${activeId}`),
    enabled: Boolean(activeId),
  });

  if (projects.length === 0) return <EmptyState icon={<BarChart3 className="size-6" />} title="پروژه‌ای وجود ندارد" description="ابتدا یک پروژه بسازید." />;

  return (
    <div className="space-y-4">
      <Select value={activeId} onValueChange={setProjectId}>
        <SelectTrigger className="w-64"><SelectValue placeholder="انتخاب پروژه" /></SelectTrigger>
        <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>

      {isLoading || !data ? <Skeleton className="h-64" /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs text-(--color-muted)">وضعیت وظایف</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Kpi label="کل" value={data.stats.total} />
              <Kpi label="تکمیل‌شده" value={data.stats.completed} />
              <Kpi label="عقب‌افتاده" value={data.stats.overdue} />
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-(--color-muted)">توزیع بر اساس وضعیت</p>
            <div className="mt-2 space-y-1.5">
              {Object.entries(data.byStatus).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[13px]"><span>{k}</span><Badge variant="outline">{toPersianDigits(v)}</Badge></div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

type TeamReportMember = {
  membershipId: string; name: string; role: string;
  counts: { total: number; completed: number; overdue: number };
  workload: {
    level: "low" | "balanced" | "high" | "overloaded";
    assignedMinutes: number;
    weeklyPlannedMinutes: number;
    trackedMinutes7d: number;
    capacityMinutes: number;
    utilizationPercent: number;
    actualUtilizationPercent: number;
    unestimatedCount: number;
  } | null;
  totalMinutesTracked: number;
};

function TeamReportTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-team-detail"],
    queryFn: () => api.get<{ members: TeamReportMember[] }>("/api/reports/team"),
  });

  if (isLoading || !data) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-2">
      {data.members.map((m) => (
        <Card key={m.membershipId} className="p-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <FileText className="size-3.5 text-slate-400" /> {m.name}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-muted)">
              <Badge variant="outline">{toPersianDigits(m.counts.completed)}/{toPersianDigits(m.counts.total)} تکمیل</Badge>
              {m.counts.overdue > 0 && <Badge variant="danger">{toPersianDigits(m.counts.overdue)} عقب‌افتاده</Badge>}
              {m.workload && <Badge variant="primary">{WORKLOAD_LABEL_FA[m.workload.level]}</Badge>}
            </div>
          </div>

          {m.workload && (
            <div className="mt-3 grid gap-3 border-t border-(--color-border) pt-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <div className="flex justify-between gap-3 text-[11px] text-(--color-muted)">
                  <span>بار برنامه‌ریزی‌شده این هفته</span>
                  <span>
                    {toPersianDigits(Math.round(m.workload.weeklyPlannedMinutes / 60 * 10) / 10)}
                    {" / "}
                    {toPersianDigits(Math.round(m.workload.capacityMinutes / 60 * 10) / 10)}
                    {" ساعت · "}
                    {toPersianDigits(m.workload.utilizationPercent)}٪
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${m.workload.level === "overloaded" ? "bg-(--color-danger)" : m.workload.level === "high" ? "bg-(--color-warning)" : "bg-(--color-primary)"}`}
                    style={{ width: `${Math.min(100, m.workload.utilizationPercent)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                <p className="text-sm font-bold text-(--color-text)">
                  {toPersianDigits(Math.round(m.workload.trackedMinutes7d / 60 * 10) / 10)} ساعت
                </p>
                <p className="text-[10px] text-(--color-muted)">زمان واقعی ۷ روز اخیر</p>
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                <p className="text-sm font-bold text-(--color-text)">
                  {toPersianDigits(m.workload.unestimatedCount)}
                </p>
                <p className="text-[10px] text-(--color-muted)">Task بدون Estimate</p>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
