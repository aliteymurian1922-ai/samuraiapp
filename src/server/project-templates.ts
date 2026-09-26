import "server-only";

import { db } from "@/db";
import {
  projectTemplates,
  projectTemplateTasks,
  taskStatuses,
  tasks,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  CreateProjectTemplateInput,
  InstantiateProjectTemplateInput,
} from "@/lib/validation/project-template";
import { NotFoundError } from "@/lib/api-response";
import { createProject } from "@/server/projects";

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function listProjectTemplates(workspaceId: string) {
  const templates = await db
    .select()
    .from(projectTemplates)
    .where(and(eq(projectTemplates.workspaceId, workspaceId), eq(projectTemplates.isActive, true)))
    .orderBy(asc(projectTemplates.name));

  if (templates.length === 0) return [];

  const templateTasks = await db
    .select()
    .from(projectTemplateTasks)
    .where(inArray(projectTemplateTasks.templateId, templates.map((template) => template.id)))
    .orderBy(projectTemplateTasks.position);

  return templates.map((template) => ({
    ...template,
    tasks: templateTasks.filter((task) => task.templateId === template.id),
  }));
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
        description: input.description || null,
        color: input.color,
        defaultPriority: input.defaultPriority,
        defaultDurationDays: input.defaultDurationDays ?? null,
        createdBy: userId,
      })
      .returning();

    if (input.tasks.length > 0) {
      await tx.insert(projectTemplateTasks).values(
        input.tasks.map((task, index) => ({
          templateId: template.id,
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          dueOffsetDays: task.dueOffsetDays ?? null,
          estimatedMinutes: task.estimatedMinutes ?? null,
          position: index,
        })),
      );
    }

    return template;
  });
}

export async function instantiateProjectTemplate(
  workspaceId: string,
  userId: string,
  templateId: string,
  input: InstantiateProjectTemplateInput,
) {
  const templates = await db
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

  const template = templates[0];
  if (!template) throw new NotFoundError("قالب پروژه یافت نشد.");

  const templateTasks = await db
    .select()
    .from(projectTemplateTasks)
    .where(eq(projectTemplateTasks.templateId, template.id))
    .orderBy(projectTemplateTasks.position);

  const start = new Date();
  const dueDate = template.defaultDurationDays
    ? addDays(start, template.defaultDurationDays).toISOString()
    : null;

  const project = await createProject(workspaceId, userId, {
    name: input.name || template.name,
    description: template.description,
    priority: template.defaultPriority,
    color: template.color,
    startDate: start.toISOString(),
    dueDate,
    memberIds: input.memberIds,
  });

  if (templateTasks.length > 0) {
    const statusRows = await db
      .select({ id: taskStatuses.id })
      .from(taskStatuses)
      .where(eq(taskStatuses.projectId, project.id))
      .orderBy(asc(taskStatuses.order))
      .limit(1);

    const statusId = statusRows[0]?.id;
    if (!statusId) throw new Error("وضعیت اولیه پروژه ساخته نشد.");

    await db.insert(tasks).values(
      templateTasks.map((task, index) => ({
        workspaceId,
        projectId: project.id,
        statusId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        creatorId: userId,
        dueDate: task.dueOffsetDays !== null ? addDays(start, task.dueOffsetDays) : null,
        estimatedMinutes: task.estimatedMinutes,
        position: (index + 1) * 1024,
      })),
    );
  }

  return project;
}
