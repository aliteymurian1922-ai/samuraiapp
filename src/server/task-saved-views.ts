import "server-only";

import { db } from "@/db";
import { taskSavedViews } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { CreateTaskSavedViewInput } from "@/lib/validation/task-saved-view";
import { NotFoundError } from "@/lib/api-response";

export async function listTaskSavedViews(workspaceId: string, userId: string) {
  return db
    .select()
    .from(taskSavedViews)
    .where(and(eq(taskSavedViews.workspaceId, workspaceId), eq(taskSavedViews.userId, userId)))
    .orderBy(asc(taskSavedViews.createdAt));
}

export async function createTaskSavedView(
  workspaceId: string,
  userId: string,
  input: CreateTaskSavedViewInput,
) {
  return db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(taskSavedViews)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(taskSavedViews.workspaceId, workspaceId), eq(taskSavedViews.userId, userId)));
    }

    const [view] = await tx
      .insert(taskSavedViews)
      .values({
        workspaceId,
        userId,
        name: input.name,
        filters: input.filters,
        isDefault: input.isDefault,
      })
      .returning();

    return view;
  });
}

export async function deleteTaskSavedView(workspaceId: string, userId: string, viewId: string) {
  const rows = await db
    .delete(taskSavedViews)
    .where(
      and(
        eq(taskSavedViews.id, viewId),
        eq(taskSavedViews.workspaceId, workspaceId),
        eq(taskSavedViews.userId, userId),
      ),
    )
    .returning({ id: taskSavedViews.id });

  if (!rows[0]) throw new NotFoundError("View ذخیره‌شده یافت نشد.");
  return rows[0];
}
