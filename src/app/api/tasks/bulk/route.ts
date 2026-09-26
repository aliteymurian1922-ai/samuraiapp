import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { bulkTaskActionSchema } from "@/lib/validation/task";
import { bulkUpdateTasks } from "@/server/tasks";
import { createNextRecurringTask } from "@/server/task-recurrence";
import { createNotification, logActivity, logAudit } from "@/server/activity";
import { ok, handleApiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    const input = bulkTaskActionSchema.parse(await req.json());

    if (input.action === "assign") {
      assertCan(role, "task.assign");
    } else if (input.action === "delete") {
      assertCan(role, "task.delete");
    } else {
      assertCan(role, "task.update");
    }

    const result = await bulkUpdateTasks(workspace.id, input);

    if (input.action === "assign" && input.assigneeId) {
      await createNotification({
        workspaceId: workspace.id,
        userId: input.assigneeId,
        type: "assignment",
        title: "چند وظیفه به شما اختصاص یافت",
        body: `${input.taskIds.length.toLocaleString("fa-IR")} وظیفه به‌صورت گروهی به شما اختصاص داده شد.`,
        priority: "important",
        link: "/app/tasks",
      });
    }

    if (input.action === "complete") {
      for (const taskId of input.taskIds) {
        const nextTask = await createNextRecurringTask(workspace.id, taskId, user.id);
        if (nextTask) {
          await logActivity({
            workspaceId: workspace.id,
            actorId: user.id,
            type: "task.recurrence.created",
            entityType: "task",
            entityId: nextTask.id,
            projectId: nextTask.projectId,
            taskId: nextTask.id,
            message: "سامورایی تکرار بعدی یک وظیفه را پس از تکمیل گروهی ساخت.",
          });
        }
      }
    }

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: `task.bulk.${input.action}`,
      entityType: "task",
      metadata: {
        count: input.taskIds.length,
        taskIds: input.taskIds,
      },
    });

    return ok({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
