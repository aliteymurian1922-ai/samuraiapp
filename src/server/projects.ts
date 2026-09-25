import "server-only";
import { db } from "@/db";
import { projects, projectMembers, taskStatuses, tasks, users } from "@/db/schema";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/validation/project";
import { computeProjectHealth, type RiskResult } from "@/lib/risk";
import { daysBetween } from "@/lib/date";

export const DEFAULT_STATUSES = [
  { name: "برنامه‌ریزی", color: "#94a3b8", isDone: false },
  { name: "در حال انجام", color: "#3b82f6", isDone: false },
  { name: "بازبینی", color: "#f59e0b", isDone: false },
  { name: "انجام‌شده", color: "#22c55e", isDone: true },
];

export async function createProject(workspaceId: string, createdBy: string, input: CreateProjectInput) {
  const [project] = await db
    .insert(projects)
    .values({
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      priority: input.priority,
      color: input.color,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createdBy,
    })
    .returning();

  await db.insert(taskStatuses).values(
    DEFAULT_STATUSES.map((s, idx) => ({
      projectId: project.id,
      name: s.name,
      color: s.color,
      isDone: s.isDone,
      order: idx,
    })),
  );

  const memberIds = Array.from(new Set([createdBy, ...input.memberIds]));
  await db.insert(projectMembers).values(
    memberIds.map((userId) => ({ projectId: project.id, userId, isOwner: userId === createdBy })),
  );

  return project;
}

export async function listProjects(workspaceId: string, opts?: { includeArchived?: boolean }) {
  const conditions = [eq(projects.workspaceId, workspaceId)];
  if (!opts?.includeArchived) conditions.push(ne(projects.status, "archived"));

  const rows = await db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(projects.createdAt);

  return rows;
}

export async function getProjectStats(projectId: string) {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${taskStatuses.isDone} = true)::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < now() and ${taskStatuses.isDone} = false)::int`,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));

  return rows[0] ?? { total: 0, completed: 0, overdue: 0 };
}

export async function getProjectHealth(projectId: string): Promise<RiskResult> {
  const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
  if (!project) return computeProjectHealth({
    totalTasks: 0, completedTasks: 0, overdueTasks: 0, blockedTasks: 0,
    dueWithin3Days: 0, progress: 0, daysSinceLastActivity: 0, isPastDueDate: false,
  });

  const stats = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${taskStatuses.isDone} = true)::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < now() and ${taskStatuses.isDone} = false)::int`,
      dueSoon: sql<number>`count(*) filter (where ${tasks.dueDate} between now() and now() + interval '3 days' and ${taskStatuses.isDone} = false)::int`,
      lastActivity: sql<Date | null>`max(${tasks.updatedAt})`,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));

  const s = stats[0];
  const daysSinceLastActivity = s.lastActivity ? daysBetween(new Date(), new Date(s.lastActivity)) : 999;

  return computeProjectHealth({
    totalTasks: s.total ?? 0,
    completedTasks: s.completed ?? 0,
    overdueTasks: s.overdue ?? 0,
    blockedTasks: 0,
    dueWithin3Days: s.dueSoon ?? 0,
    progress: project.progress,
    daysSinceLastActivity: s.total ? daysSinceLastActivity : 0,
    isPastDueDate: project.dueDate ? new Date(project.dueDate).getTime() < Date.now() : false,
  });
}

export async function getProjectMembers(projectId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, isOwner: projectMembers.isOwner })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId));
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.archivedAt = input.status === "archived" ? new Date() : null;
  }
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.color !== undefined) patch.color = input.color;
  if (input.startDate !== undefined) patch.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.progress !== undefined) patch.progress = input.progress;

  const [updated] = await db.update(projects).set(patch).where(eq(projects.id, projectId)).returning();
  return updated;
}

export async function deleteProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function getProjectById(projectId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}
