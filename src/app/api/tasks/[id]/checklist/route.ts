import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { addChecklistItem, getTaskOwnerContext } from "@/server/tasks";
import { createChecklistItemSchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "task.update");

    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    const input = createChecklistItemSchema.parse(await req.json());
    const item = await addChecklistItem(id, input.title);
    return ok({ item }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
