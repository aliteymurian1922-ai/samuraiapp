import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getTaskDetail, updateTask, softDeleteTask, getTaskOwnerContext } from "@/server/tasks";
import { updateTaskSchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";
import { logActivity, createNotification } from "@/server/activity";
import { createNextRecurringTask } from "@/server/task-recurrence";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace } = await requireWorkspaceContext();
    const task = await getTaskDetail(id, workspace.id);
    if (!task) throw new NotFoundError("وظیفه یافت نشد.");
    return ok({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "task.update");

    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    const input = updateTaskSchema.parse(await req.json());
    const task = await updateTask(id, input);

    if (input.completed) {
      await logActivity({
        workspaceId: workspace.id, actorId: user.id, type: "task.completed", entityType: "task",
        entityId: id, projectId: task.projectId, taskId: id, message: `${user.name} وظیفه «${task.title}» را تکمیل کرد.`,
      });

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
    } else if (input.assigneeId !== undefined) {
      await logActivity({
        workspaceId: workspace.id, actorId: user.id, type: "task.assigned", entityType: "task",
        entityId: id, projectId: task.projectId, taskId: id, message: `${user.name} مسئول وظیفه «${task.title}» را تغییر داد.`,
      });
      if (input.assigneeId) {
        await createNotification({
          workspaceId: workspace.id, userId: input.assigneeId, type: "assignment",
          title: "وظیفه‌ای به شما اختصاص یافت", body: task.title, priority: "important",
          link: `/app/tasks?taskId=${id}`,
        });
      }
    } else {
      await logActivity({
        workspaceId: workspace.id, actorId: user.id, type: "task.updated", entityType: "task",
        entityId: id, projectId: task.projectId, taskId: id, message: `${user.name} وظیفه «${task.title}» را به‌روزرسانی کرد.`,
      });
    }

    return ok({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "task.delete");

    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    await softDeleteTask(id);
    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "task.deleted", entityType: "task",
      entityId: id, projectId: existing.projectId, taskId: id, message: `${user.name} یک وظیفه را حذف کرد.`,
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
