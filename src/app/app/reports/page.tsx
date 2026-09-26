"use client";

import Link from "next/link";

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
import type { SalesForecastReport } from "@/server/sales-forecast";
import { formatJalaliDate } from "@/lib/date";
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
          <TabsTrigger value="sales">فروش و Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="management"><ManagementReportTab /></TabsContent>
        <TabsContent value="project"><ProjectReportTab /></TabsContent>
        <TabsContent value="team"><TeamReportTab /></TabsContent>
        <TabsContent value="sales"><SalesForecastTab /></TabsContent>
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


const salesMoney = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

function SalesForecastTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-sales-forecast"],
    queryFn: () => api.get<{ report: SalesForecastReport }>("/api/reports/sales"),
  });

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const r = data.report;
  const maxTrend = Math.max(1, ...r.trend.map((item) => Number(item.wonValue)));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs text-(--color-muted)">Forecast فروش · تولید شده در {formatJalaliDate(r.generatedAt, true)}</p>
            <p className="mt-1 text-lg font-bold text-(--color-text)">تصویر واقعی فروش ماه جاری</p>
          </div>
          <Badge variant="primary">
            Forecast: {salesMoney.format(r.summary.forecastThisMonth)} تومان
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SalesMetric label="فروش قطعی ماه" value={salesMoney.format(r.summary.wonThisMonth)} suffix="تومان" />
          <SalesMetric label="Forecast ماه" value={salesMoney.format(r.summary.forecastThisMonth)} suffix="تومان" />
          <SalesMetric label="Pipeline باز" value={salesMoney.format(r.summary.openValue)} suffix="تومان" />
          <SalesMetric label="Pipeline وزنی" value={salesMoney.format(r.summary.weightedOpenValue)} suffix="تومان" />
          <SalesMetric label="نرخ برد ماه" value={toPersianDigits(r.summary.winRateThisMonth)} suffix="٪" />
          <SalesMetric label="Deal باز" value={toPersianDigits(r.summary.openDeals)} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div>
            <p className="text-sm font-bold text-(--color-text)">روند فروش قطعی ۶ ماه اخیر</p>
            <p className="mt-1 text-xs text-(--color-muted)">فقط Dealهایی که واقعاً Won شده‌اند.</p>
          </div>

          <div className="mt-5 flex h-52 items-end gap-3 overflow-x-auto border-b border-(--color-border) pb-2">
            {r.trend.map((item) => {
              const height = Math.max(4, Math.round((Number(item.wonValue) / maxTrend) * 100));
              const monthDate = new Date(`${item.month}-01T00:00:00Z`);
              return (
                <div key={item.month} className="flex min-w-[70px] flex-1 flex-col items-center justify-end">
                  <p className="mb-2 text-[10px] font-semibold text-(--color-text)">
                    {salesMoney.format(item.wonValue)}
                  </p>
                  <div className="flex h-32 w-full items-end justify-center">
                    <div
                      className="w-8 rounded-t-lg bg-(--color-primary)"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-(--color-muted)">
                    {formatJalaliDate(monthDate).slice(0, 7)}
                  </p>
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    {toPersianDigits(item.wonDeals)} فروش
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div>
            <p className="text-sm font-bold text-(--color-text)">ترکیب Pipeline باز</p>
            <p className="mt-1 text-xs text-(--color-muted)">ارزش واقعی و وزنی هر مرحله فروش.</p>
          </div>

          {r.stages.length === 0 ? (
            <p className="mt-4 text-xs text-(--color-muted)">Deal بازی در Pipeline وجود ندارد.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {r.stages.map((stage) => {
                const width = r.summary.openValue
                  ? Math.max(4, Math.round((Number(stage.value) / Number(r.summary.openValue)) * 100))
                  : 0;
                return (
                  <div key={stage.stageId}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-(--color-text)">{stage.stageName}</span>
                        <Badge variant="outline">{toPersianDigits(stage.probability)}٪</Badge>
                      </div>
                      <span className="text-(--color-muted)">
                        {salesMoney.format(stage.value)} تومان
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-(--color-primary)" style={{ width: `${width}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>{toPersianDigits(stage.deals)} Deal</span>
                      <span>وزنی: {salesMoney.format(stage.weightedValue)} تومان</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>عملکرد اعضای فروش</CardTitle>
            <p className="mt-1 text-xs text-(--color-muted)">Pipeline، فروش قطعی و نرخ برد ماه جاری برای هر مسئول.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {r.team.length === 0 ? (
            <p className="text-xs text-(--color-muted)">داده فروش کافی وجود ندارد.</p>
          ) : (
            r.team.map((member) => (
              <div key={member.ownerId ?? member.ownerName} className="grid gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs sm:grid-cols-[1.2fr_repeat(4,1fr)] sm:items-center">
                <p className="font-bold text-(--color-text)">{member.ownerName}</p>
                <div>
                  <p className="font-semibold text-(--color-text)">{toPersianDigits(member.openDeals)}</p>
                  <p className="text-[10px] text-(--color-muted)">Deal باز</p>
                </div>
                <div>
                  <p className="font-semibold text-(--color-text)">{salesMoney.format(member.weightedValue)}</p>
                  <p className="text-[10px] text-(--color-muted)">Pipeline وزنی</p>
                </div>
                <div>
                  <p className="font-semibold text-emerald-700">{salesMoney.format(member.wonValueThisMonth)}</p>
                  <p className="text-[10px] text-(--color-muted)">فروش ماه</p>
                </div>
                <div>
                  <p className="font-semibold text-(--color-text)">{toPersianDigits(member.winRateThisMonth)}٪</p>
                  <p className="text-[10px] text-(--color-muted)">نرخ برد</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Dealهای در معرض ریسک</CardTitle>
              <p className="mt-1 text-xs text-(--color-muted)">بر اساس موعد گذشته، نبود پیگیری آینده یا احتمال پایین مرحله.</p>
            </div>
            {r.summary.overdueOpenDeals > 0 && (
              <Badge variant="danger">{toPersianDigits(r.summary.overdueOpenDeals)} موعد گذشته</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {r.riskDeals.length === 0 ? (
            <p className="text-xs text-(--color-muted)">Deal پرریسک مشخصی شناسایی نشد.</p>
          ) : (
            <div className="space-y-2">
              {r.riskDeals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/app/crm/deals/${deal.id}`}
                  className="block rounded-xl border border-(--color-border) p-3 transition hover:bg-slate-50"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-bold text-(--color-text)">{deal.title}</p>
                      <p className="mt-1 text-[11px] text-(--color-muted)">
                        {deal.ownerName || "بدون مسئول"} · {deal.stageName} · {toPersianDigits(deal.probability)}٪
                      </p>
                    </div>
                    <p className="text-xs font-extrabold text-(--color-primary)">{salesMoney.format(deal.value)} تومان</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {deal.reasons.map((reason) => <Badge key={reason} variant="warning">{reason}</Badge>)}
                    {deal.nextFollowUpAt && (
                      <Badge variant="outline">پیگیری: {formatJalaliDate(deal.nextFollowUpAt, true)}</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SalesMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-base font-extrabold text-(--color-text)">{value}{suffix ? ` ${suffix}` : ""}</p>
      <p className="mt-1 text-[10px] text-(--color-muted)">{label}</p>
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
