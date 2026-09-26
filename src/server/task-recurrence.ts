import "server-only";

import { db } from "@/db";
import {
  checklistItems,
  taskRecurrenceRules,
  taskStatuses,
  taskTags,
  tasks,
} from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type { TaskRecurrenceInput } from "@/lib/validation/task-recurrence";
import { NotFoundError } from "@/lib/api-response";

function addMonthsSafe(date: Date, months: number) {
  const day = date.getUTCDate();
  const result = new Date(date);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function nextDate(base: Date, frequency: string, interval: number) {
  if (frequency === "daily") {
    return new Date(base.getTime() + interval * 24 * 60 * 60 * 1000);
  }

  if (frequency === "weekly") {
    return new Date(base.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
  }

  return addMonthsSafe(base, interval);
}

export async function getTaskRecurrence(workspaceId: string, taskId: string) {
  const rows = await db
    .select()
    .from(taskRecurrenceRules)
    .where(and(eq(taskRecurrenceRules.workspaceId, workspaceId), eq(taskRecurrenceRules.taskId, taskId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertTaskRecurrence(
  workspaceId: string,
  taskId: string,
  userId: string,
  input: TaskRecurrenceInput,
) {
  const taskRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  if (!taskRows[0]) throw new NotFoundError("وظیفه یافت نشد.");

  const existing = await getTaskRecurrence(workspaceId, taskId);

  if (existing) {
    const [updated] = await db
      .update(taskRecurrenceRules)
      .set({
        frequency: input.frequency,
        interval: input.interval,
        endAt: input.endAt ? new Date(input.endAt) : null,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(taskRecurrenceRules.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(taskRecurrenceRules)
    .values({
      workspaceId,
      taskId,
      frequency: input.frequency,
      interval: input.interval,
      endAt: input.endAt ? new Date(input.endAt) : null,
      isActive: input.isActive,
      createdBy: userId,
    })
    .returning();

  return created;
}

export async function disableTaskRecurrence(workspaceId: string, taskId: string) {
  const [updated] = await db
    .update(taskRecurrenceRules)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(taskRecurrenceRules.workspaceId, workspaceId), eq(taskRecurrenceRules.taskId, taskId)))
    .returning();

  return updated ?? null;
}

export async function createNextRecurringTask(
  workspaceId: string,
  completedTaskId: string,
  actorId: string,
) {
  const rule = await getTaskRecurrence(workspaceId, completedTaskId);
  if (!rule || !rule.isActive) return null;

  const taskRows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, completedTaskId), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  const source = taskRows[0];
  if (!source) return null;

  const baseDueDate = source.dueDate ?? source.startDate ?? new Date();
  const dueDate = nextDate(new Date(baseDueDate), rule.frequency, rule.interval);

  if (rule.endAt && dueDate.getTime() > new Date(rule.endAt).getTime()) {
    await db
      .update(taskRecurrenceRules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(taskRecurrenceRules.id, rule.id));
    return null;
  }

  const statusRows = await db
    .select({ id: taskStatuses.id })
    .from(taskStatuses)
    .where(and(eq(taskStatuses.projectId, source.projectId), eq(taskStatuses.isDone, false)))
    .orderBy(asc(taskStatuses.order))
    .limit(1);

  const statusId = statusRows[0]?.id;
  if (!statusId) return null;

  const positionRows = await db
    .select({ max: sql<number>`coalesce(max(${tasks.position}), 0)` })
    .from(tasks)
    .where(eq(tasks.statusId, statusId));

  const position = (positionRows[0]?.max ?? 0) + 1024;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tasks)
      .values({
        workspaceId,
        projectId: source.projectId,
        statusId,
        parentTaskId: source.parentTaskId,
        title: source.title,
        description: source.description,
        priority: source.priority,
        assigneeId: source.assigneeId,
        creatorId: actorId,
        startDate: source.startDate ? nextDate(new Date(source.startDate), rule.frequency, rule.interval) : null,
        dueDate,
        estimatedMinutes: source.estimatedMinutes,
        position,
      })
      .returning();

    const [tagRows, checklistRows] = await Promise.all([
      tx.select({ tagId: taskTags.tagId }).from(taskTags).where(eq(taskTags.taskId, source.id)),
      tx
        .select({ title: checklistItems.title, order: checklistItems.order })
        .from(checklistItems)
        .where(eq(checklistItems.taskId, source.id))
        .orderBy(asc(checklistItems.order)),
    ]);

    if (tagRows.length > 0) {
      await tx.insert(taskTags).values(tagRows.map((row) => ({ taskId: created.id, tagId: row.tagId })));
    }

    if (checklistRows.length > 0) {
      await tx.insert(checklistItems).values(
        checklistRows.map((item) => ({
          taskId: created.id,
          title: item.title,
          order: item.order,
          isDone: false,
        })),
      );
    }

    await tx
      .update(taskRecurrenceRules)
      .set({
        taskId: created.id,
        occurrencesCreated: rule.occurrencesCreated + 1,
        updatedAt: new Date(),
      })
      .where(eq(taskRecurrenceRules.id, rule.id));

    return created;
  });
}
