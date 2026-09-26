import "server-only";
import { db } from "@/db";
import {
  tasks,
  taskStatuses,
  taskTags,
  tags,
  users,
  projects,
  checklistItems,
  comments,
  attachments,
  taskDependencies,
  timeEntries,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { BulkTaskActionInput, CreateTaskInput, UpdateTaskInput } from "@/lib/validation/task";
import { ApiError, NotFoundError } from "@/lib/api-response";

export type TaskFilters = {
  projectId?: string;
  assigneeId?: string;
  priority?: string;
  statusId?: string;
  search?: string;
  onlyOverdue?: boolean;
  parentTaskId?: string | null;
};

const taskSelect = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  projectId: tasks.projectId,
  statusId: tasks.statusId,
  parentTaskId: tasks.parentTaskId,
  title: tasks.title,
  description: tasks.description,
  priority: tasks.priority,
  assigneeId: tasks.assigneeId,
  creatorId: tasks.creatorId,
  startDate: tasks.startDate,
  dueDate: tasks.dueDate,
  estimatedMinutes: tasks.estimatedMinutes,
  actualMinutes: tasks.actualMinutes,
  position: tasks.position,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  statusName: taskStatuses.name,
  statusColor: taskStatuses.color,
  statusIsDone: taskStatuses.isDone,
  projectName: projects.name,
  projectColor: projects.color,
  assigneeName: users.name,
  assigneeColor: users.avatarColor,
};

export async function listTasks(workspaceId: string, filters: TaskFilters = {}) {
  const conditions = [eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)];
  if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
  if (filters.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority as never));
  if (filters.statusId) conditions.push(eq(tasks.statusId, filters.statusId));
  if (filters.parentTaskId === null) conditions.push(isNull(tasks.parentTaskId));
  if (filters.parentTaskId) conditions.push(eq(tasks.parentTaskId, filters.parentTaskId));
  if (filters.search) conditions.push(sql`${tasks.title} ilike ${"%" + filters.search + "%"}`);
  if (filters.onlyOverdue) conditions.push(sql`${tasks.dueDate} < now() and ${taskStatuses.isDone} = false`);

  return db
    .select(taskSelect)
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(...conditions))
    .orderBy(asc(tasks.position));
}

export async function getTaskDetail(taskId: string, workspaceId: string) {
  const rows = await db
    .select(taskSelect)
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)))
    .limit(1);
  const task = rows[0];
  if (!task) return null;

  const [subtasks, taskTagRows, checklist, taskComments, taskAttachments, dependencies, entries] = await Promise.all([
    db.select(taskSelect).from(tasks)
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(eq(tasks.parentTaskId, taskId), isNull(tasks.deletedAt))),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(taskTags)
      .innerJoin(tags, eq(tags.id, taskTags.tagId)).where(eq(taskTags.taskId, taskId)),
    db.select().from(checklistItems).where(eq(checklistItems.taskId, taskId)).orderBy(asc(checklistItems.order)),
    db.select({
      id: comments.id, body: comments.body, createdAt: comments.createdAt, editedAt: comments.editedAt,
      authorId: comments.authorId, authorName: users.name, authorColor: users.avatarColor,
    }).from(comments).leftJoin(users, eq(users.id, comments.authorId))
      .where(and(eq(comments.taskId, taskId), isNull(comments.deletedAt))).orderBy(asc(comments.createdAt)),
    db.select().from(attachments).where(eq(attachments.taskId, taskId)).orderBy(desc(attachments.createdAt)),
    db.select({
      id: taskDependencies.id, type: taskDependencies.type, dependsOnTaskId: taskDependencies.dependsOnTaskId,
      title: tasks.title, isDone: taskStatuses.isDone,
    }).from(taskDependencies)
      .innerJoin(tasks, eq(tasks.id, taskDependencies.dependsOnTaskId))
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .where(eq(taskDependencies.taskId, taskId)),
    db.select().from(timeEntries).where(eq(timeEntries.taskId, taskId)).orderBy(desc(timeEntries.startedAt)),
  ]);

  return { ...task, subtasks, tags: taskTagRows, checklist, comments: taskComments, attachments: taskAttachments, dependencies, timeEntries: entries };
}

export async function getNextPosition(statusId: string) {
  const rows = await db.select({ max: sql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks).where(eq(tasks.statusId, statusId));
  return (rows[0]?.max ?? 0) + 1024;
}

export async function createTask(workspaceId: string, creatorId: string, input: CreateTaskInput) {
  let statusId = input.statusId;
  if (!statusId) {
    const firstStatus = await db.select().from(taskStatuses).where(eq(taskStatuses.projectId, input.projectId)).orderBy(asc(taskStatuses.order)).limit(1);
    statusId = firstStatus[0]?.id;
  }
  if (!statusId) throw new Error("وضعیت پروژه یافت نشد.");

  const position = await getNextPosition(statusId);

  const [task] = await db.insert(tasks).values({
    workspaceId,
    projectId: input.projectId,
    statusId,
    parentTaskId: input.parentTaskId ?? null,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority,
    assigneeId: input.assigneeId ?? null,
    creatorId,
    startDate: input.startDate ? new Date(input.startDate) : null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    position,
  }).returning();

  if (input.tagIds.length > 0) {
    await db.insert(taskTags).values(input.tagIds.map((tagId) => ({ taskId: task.id, tagId })));
  }

  return task;
}

export async function getUnresolvedBlockingDependencies(taskId: string) {
  return db
    .select({
      id: taskDependencies.id,
      dependsOnTaskId: taskDependencies.dependsOnTaskId,
      title: tasks.title,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.dependsOnTaskId))
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(
      and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.type, "blocked_by"),
        eq(taskStatuses.isDone, false),
        isNull(tasks.deletedAt),
      ),
    );
}

export async function assertTaskCanComplete(taskId: string) {
  const blockers = await getUnresolvedBlockingDependencies(taskId);
  if (blockers.length === 0) return;

  const names = blockers.slice(0, 3).map((item) => `«${item.title}»`).join("، ");
  const more = blockers.length > 3 ? ` و ${blockers.length - 3} مورد دیگر` : "";

  throw new ApiError(
    `این وظیفه هنوز مسدود است. ابتدا ${names}${more} را تکمیل کنید.`,
    409,
  );
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

  const taskRows = await db
    .select({ projectId: tasks.projectId, statusId: tasks.statusId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  const currentTask = taskRows[0];

  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
  if (input.startDate !== undefined) patch.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.estimatedMinutes !== undefined) patch.estimatedMinutes = input.estimatedMinutes;
  if (input.position !== undefined) patch.position = input.position;

  if (input.statusId !== undefined) {
    patch.statusId = input.statusId;
    const statusRows = await db
      .select({ isDone: taskStatuses.isDone })
      .from(taskStatuses)
      .where(eq(taskStatuses.id, input.statusId))
      .limit(1);
    if (statusRows[0]) {
      if (statusRows[0].isDone) {
        await assertTaskCanComplete(taskId);
      }
      patch.completedAt = statusRows[0].isDone ? new Date() : null;
    }
  }

  if (input.completed !== undefined && currentTask) {
    if (input.completed) {
      await assertTaskCanComplete(taskId);
    }

    const targetRows = await db
      .select({ id: taskStatuses.id })
      .from(taskStatuses)
      .where(
        and(
          eq(taskStatuses.projectId, currentTask.projectId),
          eq(taskStatuses.isDone, input.completed),
        ),
      )
      .orderBy(asc(taskStatuses.order))
      .limit(1);

    if (targetRows[0]) patch.statusId = targetRows[0].id;
    patch.completedAt = input.completed ? new Date() : null;
  }

  const [updated] = await db.update(tasks).set(patch).where(eq(tasks.id, taskId)).returning();

  if (input.tagIds) {
    await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
    if (input.tagIds.length > 0) {
      await db.insert(taskTags).values(input.tagIds.map((tagId) => ({ taskId, tagId })));
    }
  }

  return updated;
}

export async function softDeleteTask(taskId: string) {
  await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, taskId));
}

export async function restoreTask(taskId: string) {
  await db.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, taskId));
}

export async function getTaskOwnerContext(taskId: string) {
  const rows = await db.select({ id: tasks.id, workspaceId: tasks.workspaceId, projectId: tasks.projectId, creatorId: tasks.creatorId })
    .from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return rows[0] ?? null;
}

export async function addChecklistItem(taskId: string, title: string) {
  const rows = await db.select({ max: sql<number>`coalesce(max(${checklistItems.order}), -1)` }).from(checklistItems).where(eq(checklistItems.taskId, taskId));
  const order = (rows[0]?.max ?? -1) + 1;
  const [item] = await db.insert(checklistItems).values({ taskId, title, order }).returning();
  return item;
}

export async function updateChecklistItem(id: string, patch: { title?: string; isDone?: boolean }) {
  const [item] = await db.update(checklistItems).set(patch).where(eq(checklistItems.id, id)).returning();
  return item;
}

export async function deleteChecklistItem(id: string) {
  await db.delete(checklistItems).where(eq(checklistItems.id, id));
}

export async function addComment(input: { workspaceId: string; taskId?: string; projectId?: string; authorId: string; body: string; parentCommentId?: string | null }) {
  const [comment] = await db.insert(comments).values(input).returning();
  return comment;
}

export async function deleteComment(id: string) {
  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, id));
}

export async function addDependency(taskId: string, dependsOnTaskId: string, type: "blocks" | "blocked_by") {
  if (taskId === dependsOnTaskId) {
    throw new ApiError("یک وظیفه نمی‌تواند به خودش وابسته باشد.", 400);
  }

  const relatedTasks = await db
    .select({
      id: tasks.id,
      workspaceId: tasks.workspaceId,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(inArray(tasks.id, [taskId, dependsOnTaskId]));

  const current = relatedTasks.find((task) => task.id === taskId);
  const target = relatedTasks.find((task) => task.id === dependsOnTaskId);

  if (!current || !target) {
    throw new NotFoundError("یکی از وظایف وابستگی یافت نشد.");
  }

  if (current.workspaceId !== target.workspaceId || current.projectId !== target.projectId) {
    throw new ApiError("وابستگی فقط بین وظایف یک پروژه قابل تعریف است.", 400);
  }

  if (type === "blocked_by") {
    const cycleRows = await db.execute(sql`
      with recursive dependency_chain(depends_on_task_id) as (
        select ${taskDependencies.dependsOnTaskId}
        from ${taskDependencies}
        where ${taskDependencies.taskId} = ${dependsOnTaskId}
          and ${taskDependencies.type} = 'blocked_by'
        union
        select td.depends_on_task_id
        from task_dependencies td
        inner join dependency_chain dc on td.task_id = dc.depends_on_task_id
        where td.type = 'blocked_by'
      )
      select 1
      from dependency_chain
      where depends_on_task_id = ${taskId}
      limit 1
    `);

    if (cycleRows.rows.length > 0) {
      throw new ApiError("این وابستگی یک حلقه ایجاد می‌کند و قابل ثبت نیست.", 409);
    }
  }

  const [dep] = await db
    .insert(taskDependencies)
    .values({ taskId, dependsOnTaskId, type })
    .returning();

  return dep;
}

export async function removeDependency(id: string) {
  await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
}

export async function addAttachment(input: { workspaceId: string; taskId?: string; projectId?: string; uploaderId: string; fileName: string; fileUrl: string; fileType?: string }) {
  const [attachment] = await db.insert(attachments).values(input).returning();
  return attachment;
}

export async function deleteAttachment(id: string) {
  await db.delete(attachments).where(eq(attachments.id, id));
}

export async function startTimeEntry(taskId: string, userId: string, workspaceId: string) {
  const [entry] = await db.insert(timeEntries).values({ taskId, userId, workspaceId, startedAt: new Date() }).returning();
  return entry;
}

export async function stopTimeEntry(id: string) {
  const rows = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);
  const entry = rows[0];
  if (!entry) return null;
  const endedAt = new Date();
  const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - new Date(entry.startedAt).getTime()) / 60000));
  const [updated] = await db.update(timeEntries).set({ endedAt, durationMinutes }).where(eq(timeEntries.id, id)).returning();
  await db.update(tasks).set({ actualMinutes: sql`${tasks.actualMinutes} + ${durationMinutes}` }).where(eq(tasks.id, entry.taskId));
  return updated;
}

export async function listProjectStatuses(projectId: string) {
  return db.select().from(taskStatuses).where(eq(taskStatuses.projectId, projectId)).orderBy(asc(taskStatuses.order));
}

export async function listWorkspaceTags(workspaceId: string) {
  return db.select().from(tags).where(eq(tags.workspaceId, workspaceId)).orderBy(asc(tags.name));
}

export async function createTag(workspaceId: string, name: string, color?: string) {
  const [tag] = await db.insert(tags).values({ workspaceId, name, color }).returning();
  return tag;
}

export async function getOverdueTasks(workspaceId: string, limit = 50) {
  return db
    .select(taskSelect)
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(
      eq(tasks.workspaceId, workspaceId),
      isNull(tasks.deletedAt),
      sql`${tasks.dueDate} < now()`,
      eq(taskStatuses.isDone, false),
    ))
    .orderBy(asc(tasks.dueDate))
    .limit(limit);
}

export async function getTasksByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(tasks).where(inArray(tasks.id, ids));
}


export async function bulkUpdateTasks(workspaceId: string, input: BulkTaskActionInput) {
  const selected = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      statusId: tasks.statusId,
      assigneeId: tasks.assigneeId,
      title: tasks.title,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        isNull(tasks.deletedAt),
        inArray(tasks.id, input.taskIds),
      ),
    );

  if (selected.length !== input.taskIds.length) {
    throw new NotFoundError("یک یا چند وظیفه انتخاب‌شده یافت نشد.");
  }

  if (input.action === "assign") {
    await db
      .update(tasks)
      .set({ assigneeId: input.assigneeId, updatedAt: new Date() })
      .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.id, input.taskIds)));

    return { updatedIds: input.taskIds, assigneeId: input.assigneeId };
  }

  if (input.action === "priority") {
    await db
      .update(tasks)
      .set({ priority: input.priority, updatedAt: new Date() })
      .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.id, input.taskIds)));

    return { updatedIds: input.taskIds, priority: input.priority };
  }

  if (input.action === "delete") {
    await db
      .update(tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.id, input.taskIds)));

    return { updatedIds: input.taskIds, deleted: true };
  }

  if (input.action === "status") {
    const projectIds = [...new Set(selected.map((task) => task.projectId))];
    if (projectIds.length !== 1) {
      throw new ApiError("تغییر وضعیت گروهی فقط برای وظایف یک پروژه ممکن است.", 409);
    }

    const statusRows = await db
      .select({ id: taskStatuses.id, projectId: taskStatuses.projectId, isDone: taskStatuses.isDone })
      .from(taskStatuses)
      .where(eq(taskStatuses.id, input.statusId))
      .limit(1);

    const targetStatus = statusRows[0];
    if (!targetStatus || targetStatus.projectId !== projectIds[0]) {
      throw new ApiError("وضعیت انتخاب‌شده متعلق به این پروژه نیست.", 400);
    }

    if (targetStatus.isDone) {
      for (const task of selected) {
        await assertTaskCanComplete(task.id);
      }
    }

    await db
      .update(tasks)
      .set({
        statusId: input.statusId,
        completedAt: targetStatus.isDone ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.id, input.taskIds)));

    return { updatedIds: input.taskIds, statusId: input.statusId, completed: targetStatus.isDone };
  }

  if (input.action === "complete") {
    for (const task of selected) {
      await assertTaskCanComplete(task.id);
    }
  }

  const projectIds = [...new Set(selected.map((task) => task.projectId))];
  const statusRows = await db
    .select({ id: taskStatuses.id, projectId: taskStatuses.projectId, isDone: taskStatuses.isDone, order: taskStatuses.order })
    .from(taskStatuses)
    .where(inArray(taskStatuses.projectId, projectIds))
    .orderBy(asc(taskStatuses.order));

  const targetStatusByProject = new Map<string, string>();

  for (const projectId of projectIds) {
    const projectStatuses = statusRows.filter((status) => status.projectId === projectId);
    const target = input.action === "complete"
      ? projectStatuses.find((status) => status.isDone)
      : projectStatuses.find((status) => !status.isDone);

    if (!target) {
      throw new ApiError(
        input.action === "complete"
          ? "یکی از پروژه‌ها وضعیت انجام‌شده ندارد."
          : "یکی از پروژه‌ها وضعیت باز ندارد.",
        409,
      );
    }
    targetStatusByProject.set(projectId, target.id);
  }

  await db.transaction(async (tx) => {
    for (const [projectId, statusId] of targetStatusByProject.entries()) {
      const ids = selected.filter((task) => task.projectId === projectId).map((task) => task.id);
      await tx
        .update(tasks)
        .set({
          statusId,
          completedAt: input.action === "complete" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.id, ids)));
    }
  });

  return { updatedIds: input.taskIds, completed: input.action === "complete" };
}
