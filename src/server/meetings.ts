import "server-only";
import { db } from "@/db";
import { meetings, meetingParticipants, users, actionItems, tasks, taskStatuses } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { CreateMeetingInput } from "@/lib/validation/meeting";

export async function listMeetings(workspaceId: string, range?: { from: Date; to: Date }) {
  const conditions = [eq(meetings.workspaceId, workspaceId)];
  if (range) conditions.push(gte(meetings.startTime, range.from), lte(meetings.startTime, range.to));
  return db.select().from(meetings).where(and(...conditions)).orderBy(asc(meetings.startTime));
}

export async function getMeetingDetail(id: string, workspaceId: string) {
  const rows = await db.select().from(meetings).where(and(eq(meetings.id, id), eq(meetings.workspaceId, workspaceId))).limit(1);
  const meeting = rows[0];
  if (!meeting) return null;

  const [participants, items] = await Promise.all([
    db.select({ id: users.id, name: users.name, avatarColor: users.avatarColor, status: meetingParticipants.status })
      .from(meetingParticipants).innerJoin(users, eq(users.id, meetingParticipants.userId))
      .where(eq(meetingParticipants.meetingId, id)),
    db.select().from(actionItems).where(eq(actionItems.meetingId, id)).orderBy(asc(actionItems.createdAt)),
  ]);

  return { ...meeting, participants, actionItems: items };
}

export async function createMeeting(workspaceId: string, createdBy: string, input: CreateMeetingInput) {
  const [meeting] = await db.insert(meetings).values({
    workspaceId,
    projectId: input.projectId ?? null,
    title: input.title,
    agenda: input.agenda ?? null,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
    location: input.location ?? null,
    createdBy,
  }).returning();

  const participantIds = Array.from(new Set([createdBy, ...input.participantIds]));
  if (participantIds.length > 0) {
    await db.insert(meetingParticipants).values(participantIds.map((userId) => ({ meetingId: meeting.id, userId })));
  }

  return meeting;
}

export async function updateMeetingNotes(id: string, notes: string) {
  const [updated] = await db.update(meetings).set({ notes }).where(eq(meetings.id, id)).returning();
  return updated;
}

export async function addActionItem(meetingId: string, input: { title: string; assigneeId?: string | null; dueDate?: string | null }, taskId?: string) {
  const [item] = await db.insert(actionItems).values({
    meetingId,
    title: input.title,
    assigneeId: input.assigneeId ?? null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    taskId: taskId ?? null,
  }).returning();
  return item;
}

export async function toggleActionItem(id: string, isDone: boolean) {
  const [updated] = await db.update(actionItems).set({ isDone }).where(eq(actionItems.id, id)).returning();
  return updated;
}

export async function getUpcomingMeetings(workspaceId: string, limit = 5) {
  return db.select().from(meetings)
    .where(and(eq(meetings.workspaceId, workspaceId), gte(meetings.startTime, new Date())))
    .orderBy(asc(meetings.startTime)).limit(limit);
}

export async function getTasksDueRange(workspaceId: string, from: Date, to: Date) {
  return db.select({
    id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority,
    projectId: tasks.projectId, isDone: taskStatuses.isDone,
  }).from(tasks)
    .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(and(eq(tasks.workspaceId, workspaceId), gte(tasks.dueDate, from), lte(tasks.dueDate, to)));
}
