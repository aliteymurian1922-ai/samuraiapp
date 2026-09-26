import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { updateTask, getTaskOwnerContext } from "@/server/tasks";
import { moveTaskSchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";
import { logActivity } from "@/server/activity";
import { createNextRecurringTask } from "@/server/task-recurrence";

// Dedicated lightweight endpoint for Kanban drag & drop reordering to keep
// the interaction snappy (no need to re-send the whole task payload).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "task.update");

    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    const input = moveTaskSchema.parse(await req.json());
    const task = await updateTask(id, { statusId: input.statusId, position: input.position });

    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "task.moved", entityType: "task",
      entityId: id, projectId: task.projectId, taskId: id, message: `${user.name} وضعیت وظیفه «${task.title}» را تغییر داد.`,
    });

    if (task.completedAt) {
      const nextRecurringTask = await createNextRecurringTask(workspace.id, id, user.id);
      if (nextRecurringTask) {
        await logActivity({
          workspaceId: workspace.id,
          actorId: user.id,
          type: "task.recurrence.created",
          entityType: "task",
          entityId: nextRecurringTask.id,
          projectId: nextRecurringTask.projectId,
          taskId: nextRecurringTask.id,
          message: `سامورایی تکرار بعدی وظیفه «${task.title}» را ساخت.`,
        });
      }
    }

    return ok({ task });
  } catch (error) {
    return handleApiError(error);
  }
}
