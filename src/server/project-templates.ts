import "server-only";
import { db } from "@/db";
import {
  projectMembers,
  projects,
  projectTemplateTasks,
  projectTemplates,
  taskStatuses,
  tasks,
} from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { NotFoundError } from "@/lib/api-response";
import type {
  ApplyProjectTemplateInput,
  CreateProjectTemplateInput,
} from "@/lib/validation/project-template";
import { DEFAULT_STATUSES } from "@/server/projects";

function addDays(base: Date, days: number) {
  const value = new Date(base);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

export async function listProjectTemplates(workspaceId: string) {
  const templates = await db
    .select()
    .from(projectTemplates)
    .where(and(eq(projectTemplates.workspaceId, workspaceId), eq(projectTemplates.isActive, true)))
    .orderBy(desc(projectTemplates.updatedAt));

  const result = await Promise.all(
    templates.map(async (template) => ({
      ...template,
      tasks: await db
        .select()
        .from(projectTemplateTasks)
        .where(eq(projectTemplateTasks.templateId, template.id))
        .orderBy(asc(projectTemplateTasks.position)),
    })),
  );

  return result;
}

export async function createProjectTemplate(
  workspaceId: string,
  userId: string,
  input: CreateProjectTemplateInput,
) {
  return db.transaction(async (tx) => {
    const [template] = await tx
      .insert(projectTemplates)
      .values({
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        defaultPriority: input.defaultPriority,
        defaultDurationDays: input.defaultDurationDays ?? null,
        createdBy: userId,
      })
      .returning();

    await tx.insert(projectTemplateTasks).values(
      input.tasks.map((task, index) => ({
        templateId: template.id,
        title: task.title,
        description: task.description ?? null,
        priority: task.priority,
        dueOffsetDays: task.dueOffsetDays ?? null,
        estimatedMinutes: task.estimatedMinutes ?? null,
        position: index,
      })),
    );

    return template;
  });
}

export async function applyProjectTemplate(
  workspaceId: string,
  userId: string,
  templateId: string,
  input: ApplyProjectTemplateInput,
) {
  const [template] = await db
    .select()
    .from(projectTemplates)
    .where(
      and(
        eq(projectTemplates.id, templateId),
        eq(projectTemplates.workspaceId, workspaceId),
        eq(projectTemplates.isActive, true),
      ),
    )
    .limit(1);

  if (!template) throw new NotFoundError("قالب پروژه یافت نشد.");

  const templateTasks = await db
    .select()
    .from(projectTemplateTasks)
    .where(eq(projectTemplateTasks.templateId, template.id))
    .orderBy(asc(projectTemplateTasks.position));

  const startAt = input.startDate ? new Date(input.startDate) : new Date();
  const dueAt = input.dueDate
    ? new Date(input.dueDate)
    : template.defaultDurationDays
      ? addDays(startAt, template.defaultDurationDays)
      : null;

  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        workspaceId,
        name: input.name || template.name,
        description: template.description,
        priority: template.defaultPriority,
        color: template.color,
        startDate: startAt,
        dueDate: dueAt,
        createdBy: userId,
      })
      .returning();

    const statuses = await tx
      .insert(taskStatuses)
      .values(
        DEFAULT_STATUSES.map((status, index) => ({
          projectId: project.id,
          name: status.name,
          color: status.color,
          isDone: status.isDone,
          order: index,
        })),
      )
      .returning();

    const firstStatus = statuses.sort((a, b) => a.order - b.order)[0];
    if (!firstStatus) throw new Error("وضعیت اولیه پروژه ساخته نشد.");

    const memberIds = Array.from(new Set([userId, ...input.memberIds]));
    await tx.insert(projectMembers).values(
      memberIds.map((memberId) => ({
        projectId: project.id,
        userId: memberId,
        isOwner: memberId === userId,
      })),
    );

    if (templateTasks.length > 0) {
      await tx.insert(tasks).values(
        templateTasks.map((task, index) => ({
          workspaceId,
          projectId: project.id,
          statusId: firstStatus.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          creatorId: userId,
          startDate: startAt,
          dueDate: task.dueOffsetDays === null ? null : addDays(startAt, task.dueOffsetDays),
          estimatedMinutes: task.estimatedMinutes,
          position: (index + 1) * 1024,
        })),
      );
    }

    return project;
  });
}
