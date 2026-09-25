import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { addAttachment, getTaskOwnerContext } from "@/server/tasks";
import { createAttachmentSchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "task.update");

    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    const input = createAttachmentSchema.parse(await req.json());
    const attachment = await addAttachment({
      workspaceId: workspace.id, taskId: id, uploaderId: user.id,
      fileName: input.fileName, fileUrl: input.fileUrl, fileType: input.fileType,
    });

    return ok({ attachment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
