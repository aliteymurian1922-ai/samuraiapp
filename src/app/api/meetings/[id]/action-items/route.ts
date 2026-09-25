import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { addActionItem, getMeetingDetail } from "@/server/meetings";
import { createTask } from "@/server/tasks";
import { createActionItemSchema } from "@/lib/validation/meeting";
import { ok, handleApiError, NotFoundError, ApiError } from "@/lib/api-response";
import { logActivity } from "@/server/activity";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, user } = await requireWorkspaceContext();
    const meeting = await getMeetingDetail(id, workspace.id);
    if (!meeting) throw new NotFoundError("جلسه یافت نشد.");

    const input = createActionItemSchema.parse(await req.json());

    let taskId: string | undefined;
    if (input.createTask) {
      if (!meeting.projectId) {
        throw new ApiError("برای ایجاد وظیفه از این مورد اقدام، جلسه باید به یک پروژه متصل باشد.", 400);
      }
      const task = await createTask(workspace.id, user.id, {
        projectId: meeting.projectId, title: input.title, priority: "medium",
        assigneeId: input.assigneeId, dueDate: input.dueDate, tagIds: [],
      });
      taskId = task.id;
    }

    const item = await addActionItem(id, input, taskId);
    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "action_item.created", entityType: "action_item",
      entityId: item.id, message: `${user.name} یک مورد اقدام برای جلسه «${meeting.title}» ثبت کرد.`,
    });

    return ok({ actionItem: item }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
