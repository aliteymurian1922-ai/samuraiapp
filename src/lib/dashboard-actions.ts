export type DashboardAction = {
  id: string;
  kind: "overdue_task" | "blocked_task" | "critical_project" | "overloaded_member";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
};

type TaskLike = {
  id: string;
  title: string;
  dueDate: Date | string | null;
  projectName: string;
};

type BlockedTaskLike = {
  id: string;
  title: string;
  projectName: string;
  blockerCount: number;
};

type HealthLike = {
  project: { id: string; name: string };
  health: {
    level: "healthy" | "at_risk" | "critical";
    factors: { label: string; impact: number }[];
  };
};

type WorkloadLike = {
  id: string;
  name: string;
  level: "low" | "balanced" | "high" | "overloaded";
  utilizationPercent: number;
  weeklyPlannedMinutes: number;
  capacityMinutes: number;
};

export function buildDashboardActionCenter(input: {
  myOpenTasks: TaskLike[];
  blockedTasks: BlockedTaskLike[];
  health: HealthLike[];
  workload: WorkloadLike[];
}) {
  const now = Date.now();

  const overdue: DashboardAction[] = input.myOpenTasks
    .filter((task) => task.dueDate && new Date(task.dueDate).getTime() < now)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4)
    .map((task) => ({
      id: `overdue:${task.id}`,
      kind: "overdue_task",
      severity: "critical",
      title: `موعد «${task.title}» گذشته است`,
      detail: task.projectName,
      href: `/app/tasks?taskId=${task.id}`,
    }));

  const blocked: DashboardAction[] = input.blockedTasks.slice(0, 4).map((task) => ({
    id: `blocked:${task.id}`,
    kind: "blocked_task",
    severity: "warning",
    title: `«${task.title}» مسدود است`,
    detail: `${task.projectName} · ${task.blockerCount.toLocaleString("fa-IR")} وابستگی ناتمام`,
    href: `/app/tasks?taskId=${task.id}`,
  }));

  const projects: DashboardAction[] = input.health
    .filter((item) => item.health.level === "critical")
    .slice(0, 3)
    .map((item) => ({
      id: `project:${item.project.id}`,
      kind: "critical_project",
      severity: "critical",
      title: `پروژه «${item.project.name}» بحرانی است`,
      detail: item.health.factors[0]?.label ?? "نیاز به بررسی وضعیت پروژه",
      href: `/app/projects/${item.project.id}`,
    }));

  const people: DashboardAction[] = input.workload
    .filter((member) => member.level === "overloaded")
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
    .slice(0, 3)
    .map((member) => ({
      id: `workload:${member.id}`,
      kind: "overloaded_member",
      severity: "warning",
      title: `بار کاری ${member.name} بیش از ظرفیت است`,
      detail: `${member.utilizationPercent.toLocaleString("fa-IR")}٪ ظرفیت این هفته برنامه‌ریزی شده`,
      href: "/app/team",
    }));

  const severityRank = { critical: 3, warning: 2, info: 1 };

  return [...overdue, ...blocked, ...projects, ...people]
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, 10);
}
