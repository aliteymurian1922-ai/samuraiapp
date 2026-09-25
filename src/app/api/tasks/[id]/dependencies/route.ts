import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { addDependency, getTaskOwnerContext } from "@/server/tasks";
import { createDependencySchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError, ApiError } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "task.update");

    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    const input = createDependencySchema.parse(await req.json());
    if (input.dependsOnTaskId === id) throw new ApiError("یک وظیفه نمی‌تواند به خودش وابسته باشد.", 400);

    const dep = await addDependency(id, input.dependsOnTaskId, input.type);
    return ok({ dependency: dep }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
