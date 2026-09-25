import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { listTasks, createTask } from "@/server/tasks";
import { createTaskSchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { logActivity, createNotification } from "@/server/activity";

export async function GET(req: NextRequest) {
  try {
    const { workspace } = await requireWorkspaceContext();
    const sp = req.nextUrl.searchParams;
    const tasks = await listTasks(workspace.id, {
      projectId: sp.get("projectId") ?? undefined,
      assigneeId: sp.get("assigneeId") ?? undefined,
      priority: sp.get("priority") ?? undefined,
      statusId: sp.get("statusId") ?? undefined,
      search: sp.get("search") ?? undefined,
      onlyOverdue: sp.get("overdue") === "1",
      parentTaskId: sp.get("topLevel") === "1" ? null : undefined,
    });
    return ok({ tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "task.create");

    const input = createTaskSchema.parse(await req.json());
    const task = await createTask(workspace.id, user.id, input);

    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "task.created", entityType: "task",
      entityId: task.id, projectId: task.projectId, taskId: task.id,
      message: `${user.name} وظیفه «${task.title}» را ایجاد کرد.`,
    });

    if (task.assigneeId && task.assigneeId !== user.id) {
      await createNotification({
        workspaceId: workspace.id, userId: task.assigneeId, type: "assignment",
        title: "وظیفه جدید به شما اختصاص یافت", body: task.title, priority: "important",
        link: `/app/tasks?taskId=${task.id}`,
      });
    }

    return ok({ task }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
