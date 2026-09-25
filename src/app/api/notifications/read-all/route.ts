import { requireWorkspaceContext } from "@/lib/auth/context";
import { markAllNotificationsRead } from "@/server/activity";
import { ok, handleApiError } from "@/lib/api-response";

export async function POST() {
  try {
    const { workspace, user } = await requireWorkspaceContext();
    await markAllNotificationsRead(user.id, workspace.id);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
