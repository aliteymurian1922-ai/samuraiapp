import { requireWorkspaceContext } from "@/lib/auth/context";
import { handleApiError, ok } from "@/lib/api-response";
import { deleteTaskSavedView } from "@/server/task-saved-views";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { workspace, user } = await requireWorkspaceContext();
    await deleteTaskSavedView(workspace.id, user.id, id);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
