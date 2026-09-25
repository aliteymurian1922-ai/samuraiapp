import { requireWorkspaceContext } from "@/lib/auth/context";
import { listNotifications } from "@/server/activity";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const { workspace, user } = await requireWorkspaceContext();
    const notifications = await listNotifications(user.id, workspace.id);
    return ok({ notifications });
  } catch (error) {
    return handleApiError(error);
  }
}
