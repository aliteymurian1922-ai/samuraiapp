import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { startTimeEntry, stopTimeEntry, getTaskOwnerContext } from "@/server/tasks";
import { ok, handleApiError, NotFoundError, ApiError } from "@/lib/api-response";
import { z } from "zod";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, user } = await requireWorkspaceContext();
    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["start", "stop"]), entryId: z.string().uuid().optional() }).parse(body);

    if (action.action === "start") {
      const entry = await startTimeEntry(id, user.id, workspace.id);
      return ok({ entry }, 201);
    }

    if (!action.entryId) throw new ApiError("شناسه بازه زمانی الزامی است.", 400);
    const entry = await stopTimeEntry(action.entryId);
    return ok({ entry });
  } catch (error) {
    return handleApiError(error);
  }
}
