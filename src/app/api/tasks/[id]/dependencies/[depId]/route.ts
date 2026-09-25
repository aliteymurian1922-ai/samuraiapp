import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { removeDependency } from "@/server/tasks";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ depId: string }> }) {
  try {
    const { depId } = await params;
    const { role } = await requireWorkspaceContext();
    assertCan(role, "task.update");
    await removeDependency(depId);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
