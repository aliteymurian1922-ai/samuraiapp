import "server-only";
import { db } from "@/db";
import { tasks, taskStatuses, projects, memberships, users, meetings, timeEntries } from "@/db/schema";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { classifyWorkload, type WorkloadLevel } from "@/lib/workload";
import { getProjectHealth } from "@/server/projects";

export async function getDashboardSnapshot(workspaceId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [projectCounts, taskCounts, memberCount, meetingsToday] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${projects.status} = 'active')::int`,
    }).from(projects).where(eq(projects.workspaceId, workspaceId)),

    db.select({
      total: sql<number>`count(*)::int`,
      dueToday: sql<number>`count(*) filter (where ${tasks.dueDate} between ${startOfDay} and ${endOfDay})::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < now() and ${taskStatuses.isDone} = false)::int`,
      inProgress: sql<number>`count(*) filter (where ${taskStatuses.isDone} = false)::int`,
      completed: sql<number>`count(*) filter (where ${taskStatuses.isDone} = true)::int`,
    }).from(tasks)
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt))),

    db.select({ total: sql<number>`count(*)::int` }).from(memberships).where(eq(memberships.workspaceId, workspaceId)),

    db.select({ total: sql<number>`count(*)::int` }).from(meetings)
      .where(and(eq(meetings.workspaceId, workspaceId), gte(meetings.startTime, startOfDay), lte(meetings.startTime, endOfDay))),
  ]);

  return {
    projects: projectCounts[0],
    tasks: taskCounts[0],
    members: memberCount[0]?.total ?? 0,
    meetingsToday: meetingsToday[0]?.total ?? 0,
  };
}

export async function getWorkspaceWorkload(workspaceId: string) {
  const members = await db
    .select({ id: users.id, name: users.name, avatarColor: users.avatarColor, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, workspaceId));

  const rows = await db
    .select({
      assigneeId: tasks.assigneeId,
      minutes: sql<number>`coalesce(sum(coalesce(${tasks.estimatedMinutes}, 120)), 0)::int`,
      taskCount: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < now())::int`,
    })
    .from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt), eq(taskStatuses.isDone, false)))
    .groupBy(tasks.assigneeId);

  const map = new Map(rows.map((r) => [r.assigneeId, r]));

  return members.map((m) => {
    const stat = map.get(m.id);
    const minutes = stat?.minutes ?? 0;
    const level: WorkloadLevel = classifyWorkload(minutes);
    return {
      id: m.id,
      name: m.name,
      avatarColor: m.avatarColor,
      role: m.role,
      assignedMinutes: minutes,
      taskCount: stat?.taskCount ?? 0,
      overdueCount: stat?.overdue ?? 0,
      level,
    };
  });
}

export async function getCompletedTasksTrend(workspaceId: string, days = 14) {
  const rows = await db
    .select({
      day: sql<string>`to_char(${tasks.completedAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(and(
      eq(tasks.workspaceId, workspaceId),
      sql`${tasks.completedAt} is not null`,
      sql`${tasks.completedAt} > now() - (${days}::text || ' days')::interval`,
    ))
    .groupBy(sql`to_char(${tasks.completedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${tasks.completedAt}, 'YYYY-MM-DD')`);
  return rows;
}

export async function getProjectHealthOverview(workspaceId: string) {
  const projectRows = await db.select().from(projects).where(and(eq(projects.workspaceId, workspaceId), sql`${projects.status} != 'archived'`));
  const results = await Promise.all(
    projectRows.map(async (p) => ({ project: p, health: await getProjectHealth(p.id) })),
  );
  return results;
}

export async function getTeamTimeReport(workspaceId: string, days = 30) {
  const rows = await db
    .select({
      userId: timeEntries.userId,
      userName: users.name,
      totalMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::int`,
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(and(eq(timeEntries.workspaceId, workspaceId), sql`${timeEntries.startedAt} > now() - (${days}::text || ' days')::interval`))
    .groupBy(timeEntries.userId, users.name);
  return rows;
}
