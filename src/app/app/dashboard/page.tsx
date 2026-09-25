import Link from "next/link";
import { requireWorkspaceContext } from "@/lib/auth/context";
import {
  getDashboardSnapshot,
  getProjectHealthOverview,
  getWorkspaceWorkload,
  getCompletedTasksTrend,
} from "@/server/analytics";
import { getOverdueTasks, listTasks } from "@/server/tasks";
import { listActivity } from "@/server/activity";
import { getUpcomingMeetings } from "@/server/meetings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { CompletionTrendChart, WorkloadChart } from "@/components/dashboard/charts";
import { formatJalaliDate, relativeTimeFa } from "@/lib/date";
import { toPersianDigits } from "@/lib/utils";
import { RISK_LEVEL_LABEL_FA } from "@/lib/risk";
import { WORKLOAD_LABEL_FA } from "@/lib/workload";
import {
  FolderKanban, ListChecks, Users, HeartPulse, AlertTriangle, Video, Sparkles, ArrowLeft, Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, workspace } = await requireWorkspaceContext();

  const [snapshot, health, workload, trend, overdue, myTasks, activity, meetings] = await Promise.all([
    getDashboardSnapshot(workspace.id),
    getProjectHealthOverview(workspace.id),
    getWorkspaceWorkload(workspace.id),
    getCompletedTasksTrend(workspace.id),
    getOverdueTasks(workspace.id, 6),
    listTasks(workspace.id, { assigneeId: user.id }),
    listActivity(workspace.id, { limit: 8 }),
    getUpcomingMeetings(workspace.id, 3),
  ]);

  const myOpenTasks = myTasks.filter((t) => !t.statusIsDone);
  const myOverdue = myOpenTasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now());
  const criticalProjects = health.filter((h) => h.health.level === "critical");
  const atRiskProjects = health.filter((h) => h.health.level === "at_risk");
  const overloaded = workload.filter((w) => w.level === "overloaded");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صبح بخیر" : hour < 18 ? "ظهر بخیر" : "عصر بخیر";

  const recommendations = [
    ...criticalProjects.map((p) => `پروژه «${p.project.name}» بحرانی است — عوامل اصلی: ${p.health.factors[0]?.label ?? "نامشخص"}.`),
    ...overloaded.map((m) => `${m.name} بیش از ظرفیت وظیفه دارد؛ بازتوزیع وظایف پیشنهاد می‌شود.`),
    ...(overdue.length > 3 ? [`${overdue.length} وظیفه در کل Workspace عقب‌افتاده است؛ اولویت‌بندی مجدد لازم است.`] : []),
  ].slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Daily brief header */}
      <Card className="surface-raised border-none bg-gradient-to-l from-indigo-600 to-violet-600 p-5 text-white sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium text-indigo-100">Samurai Brief · {formatJalaliDate(new Date(), true)}</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">{greeting}، {user.name.split(" ")[0]}!</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-indigo-100">
              امروز {toPersianDigits(myOpenTasks.length)} وظیفه باز دارید
              {myOverdue.length > 0 && <> که {toPersianDigits(myOverdue.length)} مورد از آن‌ها عقب‌افتاده است</>}.
              {meetings.length > 0 && <> نزدیک‌ترین جلسه شما «{meetings[0].title}» است.</>}
              {criticalProjects.length > 0 && <> {toPersianDigits(criticalProjects.length)} پروژه نیاز به توجه فوری دارد.</>}
            </p>
          </div>
          <Link href="/app/tasks" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium backdrop-blur hover:bg-white/25">
            مشاهده وظایف امروز <ArrowLeft className="size-4" />
          </Link>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={FolderKanban} label="پروژه‌ها" value={snapshot.projects.total} sub={`${toPersianDigits(snapshot.projects.active)} فعال`} color="#4f46e5" />
        <KpiCard icon={ListChecks} label="وظایف باز" value={snapshot.tasks.inProgress} sub={`${toPersianDigits(snapshot.tasks.dueToday)} امروز`} color="#7c3aed" />
        <KpiCard icon={Users} label="اعضای تیم" value={snapshot.members} sub={overloaded.length > 0 ? `${toPersianDigits(overloaded.length)} بیش از ظرفیت` : "متعادل"} color="#0891b2" />
        <KpiCard icon={HeartPulse} label="وظایف عقب‌افتاده" value={snapshot.tasks.overdue} sub={snapshot.tasks.overdue > 0 ? "نیاز به بررسی" : "وضعیت خوب"} color={snapshot.tasks.overdue > 0 ? "#dc2626" : "#16a34a"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Project health */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>سلامت پروژه‌ها</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {health.length === 0 ? (
              <EmptyState icon={<FolderKanban className="size-5" />} title="هنوز پروژه‌ای ایجاد نکرده‌اید" description="اولین پروژه خود را بسازید تا وضعیت سلامت آن را اینجا ببینید." action={<Link href="/app/projects" className="text-xs font-medium text-(--color-primary)">ایجاد اولین پروژه</Link>} />
            ) : (
              health.slice(0, 5).map(({ project, health: h }) => (
                <Link key={project.id} href={`/app/projects/${project.id}`} className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-white p-3 transition hover:bg-slate-50">
                  <div className="size-2.5 shrink-0 rounded-full" style={{ background: project.color ?? "#4f46e5" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{project.name}</p>
                    <Progress value={project.progress} className="mt-1.5 h-1.5" />
                  </div>
                  <Badge variant={h.level === "healthy" ? "success" : h.level === "at_risk" ? "warning" : "danger"}>
                    {toPersianDigits(h.score)} · {RISK_LEVEL_LABEL_FA[h.level]}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* My tasks */}
        <Card>
          <CardHeader><CardTitle>وظایف من</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myOpenTasks.length === 0 ? (
              <EmptyState icon={<ListChecks className="size-5" />} title="وظیفه بازی ندارید" description="عالی است! می‌توانید به تیم کمک کنید." />
            ) : (
              myOpenTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-white px-3 py-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: t.priority === "critical" ? "#dc2626" : t.priority === "high" ? "#d97706" : "#94a3b8" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{t.title}</p>
                    <p className="text-[11px] text-(--color-muted)">{t.projectName}</p>
                  </div>
                  {t.dueDate && <span className="shrink-0 text-[11px] text-slate-400">{formatJalaliDate(t.dueDate)}</span>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>روند تکمیل وظایف (۱۴ روز اخیر)</CardTitle></CardHeader>
          <CardContent><CompletionTrendChart data={trend} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>بار کاری تیم</CardTitle></CardHeader>
          <CardContent>
            <WorkloadChart data={workload.map((w) => ({ name: w.name.split(" ")[0], assignedHours: Math.round(w.assignedMinutes / 60) }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Activity feed */}
        <Card>
          <CardHeader><CardTitle>فعالیت‌های اخیر</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <EmptyState title="هنوز فعالیتی ثبت نشده است." />
            ) : (
              activity.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-slate-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-(--color-text)">{a.message}</p>
                    <p className="text-[11px] text-slate-400">{relativeTimeFa(a.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card className="border-(--color-primary-soft)">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-(--color-primary)" /> پیشنهادهای Samurai AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.length === 0 ? (
              <EmptyState icon={<Sparkles className="size-5" />} title="همه‌چیز مرتب است" description="در حال حاضر هشدار مهمی برای تیم شما ثبت نشده است." />
            ) : (
              recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-(--color-primary-soft) px-3 py-2.5 text-[13px] text-(--color-text)">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-(--color-primary)" />
                  {r}
                </div>
              ))
            )}
            <Link href="/app/ai" className="mt-1 flex items-center gap-1.5 text-xs font-medium text-(--color-primary)">
              گفتگو با Samurai AI برای تحلیل عمیق‌تر <ArrowLeft className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {meetings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Video className="size-4" /> جلسات پیش‌رو</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {meetings.map((m) => (
              <div key={m.id} className="rounded-xl border border-(--color-border) bg-white p-3">
                <p className="text-[13px] font-semibold">{m.title}</p>
                <p className="mt-1 text-xs text-(--color-muted)">{formatJalaliDate(m.startTime, true)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 pb-4 text-xs text-(--color-muted)">
        {overloaded.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-full border border-(--color-border) bg-white px-3 py-1.5">
            <Avatar name={m.name} color={m.avatarColor} size={20} />
            {m.name} · {WORKLOAD_LABEL_FA[m.level]}
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: typeof FolderKanban; label: string; value: number; sub: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: `${color}1a`, color }}>
          <Icon className="size-[18px]" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-(--color-text)">{toPersianDigits(value)}</p>
      <p className="text-xs text-(--color-muted)">{label} · {sub}</p>
    </Card>
  );
}
