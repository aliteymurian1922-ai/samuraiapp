import "server-only";
import { db } from "@/db";
import { memberships, users, projectMembers, tasks, taskStatuses } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { MembershipRole } from "@/lib/permissions";

export async function listWorkspaceMembers(workspaceId: string) {
  return db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
      role: memberships.role,
      lastSeenAt: users.lastSeenAt,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(memberships.createdAt);
}

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function addMembership(workspaceId: string, userId: string, role: MembershipRole) {
  const [m] = await db.insert(memberships).values({ workspaceId, userId, role }).returning();
  return m;
}

export async function updateMembershipRole(membershipId: string, role: MembershipRole) {
  const [m] = await db.update(memberships).set({ role }).where(eq(memberships.id, membershipId)).returning();
  return m;
}

export async function removeMembership(membershipId: string) {
  await db.delete(memberships).where(eq(memberships.id, membershipId));
}

export async function getMembershipById(membershipId: string) {
  const rows = await db.select().from(memberships).where(eq(memberships.id, membershipId)).limit(1);
  return rows[0] ?? null;
}

export async function getMemberTaskCounts(userId: string, workspaceId: string) {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${taskStatuses.isDone} = true)::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < now() and ${taskStatuses.isDone} = false)::int`,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(tasks.assigneeId, userId), eq(tasks.workspaceId, workspaceId)));
  return rows[0] ?? { total: 0, completed: 0, overdue: 0 };
}

export async function isUserInProject(projectId: string, userId: string) {
  const rows = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).limit(1);
  return Boolean(rows[0]);
}
