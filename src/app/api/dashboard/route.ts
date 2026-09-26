import { requireWorkspaceContext } from "@/lib/auth/context";
import { getDashboardSnapshot, getProjectHealthOverview, getWorkspaceWorkload, getCompletedTasksTrend } from "@/server/analytics";
import { getOverdueTasks, listTasks } from "@/server/tasks";
import { listActivity } from "@/server/activity";
import { getUpcomingMeetings } from "@/server/meetings";
import { ok, handleApiError } from "@/lib/api-response";
import { syncTaskRemindersForUser } from "@/server/task-reminders";

export async function GET() {
  try {
    const { workspace, user } = await requireWorkspaceContext();

    await syncTaskRemindersForUser(workspace.id, user.id);

    const [snapshot, health, workload, trend, overdue, myTasks, activity, meetings] = await Promise.all([
      getDashboardSnapshot(workspace.id),
      getProjectHealthOverview(workspace.id),
      getWorkspaceWorkload(workspace.id),
      getCompletedTasksTrend(workspace.id),
      getOverdueTasks(workspace.id, 8),
      listTasks(workspace.id, { assigneeId: user.id }),
      listActivity(workspace.id, { limit: 10 }),
      getUpcomingMeetings(workspace.id, 5),
    ]);

    return ok({
      snapshot, health, workload, trend, overdue,
      myTasks: myTasks.filter((t) => !t.statusIsDone).slice(0, 8),
      activity, meetings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
