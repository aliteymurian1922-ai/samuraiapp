import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { addComment, getTaskOwnerContext } from "@/server/tasks";
import { createCommentSchema } from "@/lib/validation/task";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";
import { logActivity, createNotification } from "@/server/activity";
import { db } from "@/db";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "comment.create");

    const existing = await getTaskOwnerContext(id);
    if (!existing || existing.workspaceId !== workspace.id) throw new NotFoundError("وظیفه یافت نشد.");

    const input = createCommentSchema.parse(await req.json());
    const comment = await addComment({
      workspaceId: workspace.id, taskId: id, authorId: user.id, body: input.body, parentCommentId: input.parentCommentId,
    });

    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "comment.created", entityType: "comment",
      entityId: comment.id, projectId: existing.projectId, taskId: id, message: `${user.name} روی یک وظیفه نظر ثبت کرد.`,
    });

    const mentionMatches = Array.from(input.body.matchAll(/@([\p{L}\d_]+)/gu)).map((m) => m[1]);
    if (mentionMatches.length > 0) {
      const mentioned = await db.select().from(users).where(inArray(users.name, mentionMatches));
      for (const m of mentioned) {
        if (m.id === user.id) continue;
        await createNotification({
          workspaceId: workspace.id, userId: m.id, type: "mention",
          title: `${user.name} شما را منشن کرد`, body: input.body.slice(0, 140), priority: "important",
          link: `/app/tasks?taskId=${id}`,
        });
      }
    }

    return ok({ comment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
