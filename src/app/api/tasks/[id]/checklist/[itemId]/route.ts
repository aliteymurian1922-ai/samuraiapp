import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { updateChecklistItem, deleteChecklistItem } from "@/server/tasks";
import { updateChecklistItemSchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const { role } = await requireWorkspaceContext();
    assertCan(role, "task.update");
    const input = updateChecklistItemSchema.parse(await req.json());
    const item = await updateChecklistItem(itemId, input);
    return ok({ item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const { role } = await requireWorkspaceContext();
    assertCan(role, "task.update");
    await deleteChecklistItem(itemId);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
