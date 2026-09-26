import { requireWorkspaceContext } from "@/lib/auth/context";
import { listNotifications } from "@/server/activity";
import { ok, handleApiError } from "@/lib/api-response";
import { syncTaskRemindersForUser } from "@/server/task-reminders";

export async function GET() {
  try {
    const { workspace, user } = await requireWorkspaceContext();
    await syncTaskRemindersForUser(workspace.id, user.id);
    const notifications = await listNotifications(user.id, workspace.id);
    return ok({ notifications });
  } catch (error) {
    return handleApiError(error);
  }
}
