import "server-only";
import { db } from "@/db";
import { projects, tasks, users, memberships, meetings, comments } from "@/db/schema";
import { and, eq, ilike, isNull } from "drizzle-orm";

export async function globalSearch(workspaceId: string, query: string) {
  const q = `%${query}%`;
  if (!query.trim()) {
    return { projects: [], tasks: [], members: [], meetings: [], comments: [] };
  }

  const [projectResults, taskResults, memberResults, meetingResults, commentResults] = await Promise.all([
    db.select({ id: projects.id, name: projects.name }).from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), ilike(projects.name, q))).limit(6),
    db.select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId }).from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt), ilike(tasks.title, q))).limit(8),
    db.select({ id: users.id, name: users.name, email: users.email }).from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.workspaceId, workspaceId), ilike(users.name, q))).limit(6),
    db.select({ id: meetings.id, title: meetings.title }).from(meetings)
      .where(and(eq(meetings.workspaceId, workspaceId), ilike(meetings.title, q))).limit(6),
    db.select({ id: comments.id, body: comments.body, taskId: comments.taskId }).from(comments)
      .where(and(eq(comments.workspaceId, workspaceId), ilike(comments.body, q))).limit(6),
  ]);

  return {
    projects: projectResults,
    tasks: taskResults,
    members: memberResults,
    meetings: meetingResults,
    comments: commentResults,
  };
}
