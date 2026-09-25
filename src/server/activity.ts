import "server-only";
import { db } from "@/db";
import { activities, auditLogs, notifications } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function logActivity(input: {
  workspaceId: string;
  actorId: string | null;
  type: string;
  entityType: string;
  entityId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activities).values({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
  });
}

export async function logAudit(input: {
  workspaceId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  await db.insert(auditLogs).values({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
    ip: input.ip ?? null,
  });
}

export async function listActivity(workspaceId: string, opts?: { projectId?: string; limit?: number }) {
  const conditions = [eq(activities.workspaceId, workspaceId)];
  if (opts?.projectId) conditions.push(eq(activities.projectId, opts.projectId));
  return db
    .select()
    .from(activities)
    .where(and(...conditions))
    .orderBy(desc(activities.createdAt))
    .limit(opts?.limit ?? 30);
}

export async function createNotification(input: {
  workspaceId: string;
  userId: string;
  type: (typeof notifications.$inferInsert)["type"];
  title: string;
  body?: string;
  link?: string;
  priority?: (typeof notifications.$inferInsert)["priority"];
}) {
  await db.insert(notifications).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    priority: input.priority ?? "important",
  });
}

export async function listNotifications(userId: string, workspaceId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationRead(id: string, userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: string, workspaceId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId)));
}
