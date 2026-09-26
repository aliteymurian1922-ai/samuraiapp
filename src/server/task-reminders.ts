import "server-only";

import { db } from "@/db";
import {
  notifications,
  taskReminderEvents,
  tasks,
  taskStatuses,
} from "@/db/schema";
import { and, eq, isNull, lte } from "drizzle-orm";

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function syncTaskRemindersForUser(workspaceId: string, userId: string) {
  const now = new Date();
  const horizon = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

  const dueTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.assigneeId, userId),
        eq(taskStatuses.isDone, false),
        isNull(tasks.deletedAt),
        lte(tasks.dueDate, horizon),
      ),
    )
    .limit(100);

  let created = 0;

  for (const task of dueTasks) {
    if (!task.dueDate) continue;

    const dueAt = new Date(task.dueDate);
    const overdue = dueAt.getTime() < now.getTime();
    const reminderType = overdue ? "overdue" : "due_soon";

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(taskReminderEvents)
        .values({
          workspaceId,
          userId,
          taskId: task.id,
          reminderType,
          dueAt,
        })
        .onConflictDoNothing()
        .returning({ id: taskReminderEvents.id });

      if (!inserted[0]) return;

      await tx.insert(notifications).values({
        workspaceId,
        userId,
        type: overdue ? "overdue" : "due_date",
        priority: overdue || task.priority === "critical" ? "critical" : "important",
        title: overdue ? "وظیفه عقب افتاده" : "موعد وظیفه نزدیک است",
        body: overdue
          ? `موعد «${task.title}» گذشته است. وضعیت آن را بررسی کنید.`
          : `کمتر از ۲۴ ساعت تا موعد «${task.title}» باقی مانده است.`,
        link: `/app/tasks?taskId=${task.id}`,
      });

      created += 1;
    });
  }

  return { created, checked: dueTasks.length };
}
