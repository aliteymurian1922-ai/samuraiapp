import "server-only";
import { getProjectHealthOverview, getDashboardSnapshot, getWorkspaceWorkload } from "@/server/analytics";
import { getOverdueTasks } from "@/server/tasks";
import { RISK_LEVEL_LABEL_FA } from "@/lib/risk";
import { WORKLOAD_LABEL_FA } from "@/lib/workload";
import { formatJalaliDate } from "@/lib/date";

/**
 * Rule-based management report builder. Works fully offline (no AI key
 * required) so the "Management Report" feature is always real & functional.
 * When Samurai AI is configured, the AI layer can further narrate this data
 * (see src/ai/tools.ts -> getManagementReportData) without inventing numbers.
 */
export async function buildManagementReport(workspaceId: string) {
  const [snapshot, healthOverview, overdue, workload] = await Promise.all([
    getDashboardSnapshot(workspaceId),
    getProjectHealthOverview(workspaceId),
    getOverdueTasks(workspaceId, 10),
    getWorkspaceWorkload(workspaceId),
  ]);

  const critical = healthOverview.filter((p) => p.health.level === "critical");
  const atRisk = healthOverview.filter((p) => p.health.level === "at_risk");
  const healthy = healthOverview.filter((p) => p.health.level === "healthy");
  const overloaded = workload.filter((w) => w.level === "overloaded");

  const completionRate = snapshot.tasks.total
    ? Math.round((snapshot.tasks.completed / snapshot.tasks.total) * 100)
    : 0;

  const overallHealth: "healthy" | "at_risk" | "critical" =
    critical.length > 0 ? "critical" : atRisk.length > 0 ? "at_risk" : "healthy";

  return {
    generatedAt: formatJalaliDate(new Date(), true),
    overallHealth,
    overallHealthLabel: RISK_LEVEL_LABEL_FA[overallHealth],
    kpis: {
      totalProjects: snapshot.projects.total,
      activeProjects: snapshot.projects.active,
      completionRate,
      overdueRate: snapshot.tasks.total ? Math.round((snapshot.tasks.overdue / snapshot.tasks.total) * 100) : 0,
      teamMembers: snapshot.members,
    },
    achievements: healthy.map((p) => `پروژه «${p.project.name}» با وضعیت سالم (امتیاز ${p.health.score}) در مسیر درست قرار دارد.`),
    problems: [
      ...critical.map((p) => `پروژه «${p.project.name}» در وضعیت بحرانی است (امتیاز ${p.health.score}).`),
      ...atRisk.map((p) => `پروژه «${p.project.name}» در معرض خطر است (امتیاز ${p.health.score}).`),
    ],
    risks: [
      ...(overdue.length > 0 ? [`${overdue.length} وظیفه در کل Workspace عقب‌افتاده است.`] : []),
      ...overloaded.map((m) => `${m.name} بیش از ظرفیت معمول، وظیفه دارد (${WORKLOAD_LABEL_FA[m.level]}).`),
    ],
    teamPerformance: workload.map((w) => ({
      name: w.name,
      level: w.level,
      levelLabel: WORKLOAD_LABEL_FA[w.level],
      taskCount: w.taskCount,
      overdueCount: w.overdueCount,
    })),
    projectPerformance: healthOverview.map((p) => ({
      name: p.project.name,
      score: p.health.score,
      level: p.health.level,
      levelLabel: RISK_LEVEL_LABEL_FA[p.health.level],
      factors: p.health.factors,
    })),
    recommendations: [
      ...(overloaded.length > 0 ? [`تقسیم مجدد وظایف اعضای دارای بار اضافه: ${overloaded.map((m) => m.name).join("، ")}`] : []),
      ...(critical.length > 0 ? [`بازبینی فوری برنامه‌ریزی پروژه‌های بحرانی: ${critical.map((p) => p.project.name).join("، ")}`] : []),
      ...(overdue.length > 0 ? ["اولویت‌بندی مجدد وظایف عقب‌افتاده در جلسه روزانه تیم"] : []),
    ],
    nextWeekPriorities: overdue.slice(0, 5).map((t) => t.title),
  };
}

export type ManagementReport = Awaited<ReturnType<typeof buildManagementReport>>;
