import { getDashboardSnapshot, getWorkspaceWorkload, getProjectHealthOverview } from "@/server/analytics";
import { listProjects } from "@/server/projects";
import { getOverdueTasks, listTasks } from "@/server/tasks";
import { listActivity } from "@/server/activity";
import { getUpcomingMeetings } from "@/server/meetings";
import { buildManagementReport } from "@/server/reports";
import { formatJalaliDate } from "@/lib/date";

/**
 * Read-only, workspace-scoped data tools for Samurai AI.
 * Every tool takes the already-authorized workspaceId from the server
 * context — the model never receives or can request another workspace's id.
 */
export function buildAiTools(workspaceId: string) {
  return {
    get_dashboard_snapshot: {
      description: "خلاصه وضعیت کلی Workspace شامل تعداد پروژه‌ها، وظایف امروز، عقب‌افتاده و اعضا را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => getDashboardSnapshot(workspaceId),
    },
    get_projects: {
      description: "لیست پروژه‌های Workspace به همراه وضعیت، اولویت و پیشرفت را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const projects = await listProjects(workspaceId);
        return projects.map((p) => ({
          id: p.id, name: p.name, status: p.status, priority: p.priority,
          progress: p.progress, dueDate: p.dueDate ? formatJalaliDate(p.dueDate) : null,
        }));
      },
    },
    get_project_health: {
      description: "امتیاز سلامت (Risk Score 0-100) و عوامل تأثیرگذار برای همه پروژه‌های فعال را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const overview = await getProjectHealthOverview(workspaceId);
        return overview.map((o) => ({
          project: o.project.name, score: o.health.score, level: o.health.level,
          factors: o.health.factors.map((f) => f.label),
        }));
      },
    },
    get_overdue_tasks: {
      description: "لیست وظایف عقب‌افتاده در کل Workspace را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const rows = await getOverdueTasks(workspaceId, 30);
        return rows.map((t) => ({
          id: t.id, title: t.title, project: t.projectName, assignee: t.assigneeName ?? "بدون مسئول",
          dueDate: t.dueDate ? formatJalaliDate(t.dueDate) : null, priority: t.priority,
        }));
      },
    },
    get_team_workload: {
      description: "وضعیت بار کاری (Workload) هر عضو تیم برای هفته جاری را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const workload = await getWorkspaceWorkload(workspaceId);
        return workload.map((w) => ({
          name: w.name, level: w.level, taskCount: w.taskCount,
          overdueCount: w.overdueCount, assignedHours: Math.round(w.assignedMinutes / 60),
        }));
      },
    },
    get_recent_activity: {
      description: "فعالیت‌های اخیر تیم (Activity Feed) را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const rows = await listActivity(workspaceId, { limit: 15 });
        return rows.map((a) => ({ message: a.message, at: formatJalaliDate(a.createdAt) }));
      },
    },
    get_upcoming_meetings: {
      description: "جلسات آینده Workspace را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const rows = await getUpcomingMeetings(workspaceId, 8);
        return rows.map((m) => ({ title: m.title, startTime: formatJalaliDate(m.startTime) }));
      },
    },
    get_member_tasks: {
      description: "وظایف باز یک عضو خاص را بر اساس نام برمی‌گرداند.",
      parameters: {
        type: "object",
        properties: { memberName: { type: "string", description: "نام عضو تیم" } },
        required: ["memberName"],
      },
      run: async ({ memberName }: { memberName: string }) => {
        const all = await listTasks(workspaceId, {});
        const matches = all.filter((t) => t.assigneeName?.includes(memberName));
        return matches.slice(0, 20).map((t) => ({
          title: t.title, project: t.projectName, status: t.statusName,
          dueDate: t.dueDate ? formatJalaliDate(t.dueDate) : null, priority: t.priority,
        }));
      },
    },
    get_management_report_data: {
      description: "داده ساختاریافته برای تولید گزارش مدیریتی هفتگی (اتفاقات، مشکلات، ریسک‌ها، پیشنهادها) را برمی‌گرداند.",
      parameters: { type: "object", properties: {} },
      run: async () => buildManagementReport(workspaceId),
    },
    propose_action: {
      description:
        "برای هرگونه عملیات نوشتنی (ایجاد پروژه، ایجاد چند وظیفه، ایجاد جلسه) باید از این ابزار استفاده شود تا ابتدا پیش‌نمایش به کاربر نمایش داده و تأیید گرفته شود. هرگز مستقیم داده تغییر نمی‌دهد.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["create_project", "create_tasks", "create_meeting"] },
          summary: { type: "string", description: "خلاصه یک خطی از کاری که قرار است انجام شود، به فارسی" },
          payload: { type: "object", description: "جزئیات ساختاریافته عملیات" },
        },
        required: ["type", "summary", "payload"],
      },
      run: async (args: { type: string; summary: string; payload: Record<string, unknown> }) => args,
      terminal: true,
    },
  } as const;
}

export type AiToolName = keyof ReturnType<typeof buildAiTools>;
