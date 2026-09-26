import { requireWorkspaceContext } from "@/lib/auth/context";
import { getDashboardSnapshot, getProjectHealthOverview, getWorkspaceWorkload, getCompletedTasksTrend } from "@/server/analytics";
import { getBlockedTasks, getOverdueTasks, listTasks } from "@/server/tasks";
import { listActivity } from "@/server/activity";
import { getUpcomingMeetings } from "@/server/meetings";
import { ok, handleApiError } from "@/lib/api-response";
import { syncTaskRemindersForUser } from "@/server/task-reminders";
import { buildDashboardActionCenter } from "@/lib/dashboard-actions";

export async function GET() {
  try {
    const { workspace, user } = await requireWorkspaceContext();

    await syncTaskRemindersForUser(workspace.id, user.id);

    const [snapshot, health, workload, trend, overdue, myTasks, activity, meetings, blockedTasks] = await Promise.all([
      getDashboardSnapshot(workspace.id),
      getProjectHealthOverview(workspace.id),
      getWorkspaceWorkload(workspace.id),
      getCompletedTasksTrend(workspace.id),
      getOverdueTasks(workspace.id, 8),
      listTasks(workspace.id, { assigneeId: user.id }),
      listActivity(workspace.id, { limit: 10 }),
      getUpcomingMeetings(workspace.id, 5),
      getBlockedTasks(workspace.id, 8),
    ]);

    const myOpenTasks = myTasks.filter((task) => !task.statusIsDone);
    const actionCenter = buildDashboardActionCenter({
      myOpenTasks,
      blockedTasks,
      health,
      workload,
    });

    return ok({
      snapshot, health, workload, trend, overdue,
      myTasks: myOpenTasks.slice(0, 8),
      activity, meetings, actionCenter,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
