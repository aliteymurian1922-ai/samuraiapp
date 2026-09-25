import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { restoreTask, getTaskOwnerContext } from "@/server/tasks";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace } = await requireWorkspaceContext();
    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");
    await restoreTask(id);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
