import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { handleApiError, ok } from "@/lib/api-response";
import { createTaskSavedViewSchema } from "@/lib/validation/task-saved-view";
import { createTaskSavedView, listTaskSavedViews } from "@/server/task-saved-views";

export async function GET() {
  try {
    const { workspace, user } = await requireWorkspaceContext();
    const views = await listTaskSavedViews(workspace.id, user.id);
    return ok({ views });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, user } = await requireWorkspaceContext();
    const input = createTaskSavedViewSchema.parse(await req.json());
    const view = await createTaskSavedView(workspace.id, user.id, input);
    return ok({ view }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
