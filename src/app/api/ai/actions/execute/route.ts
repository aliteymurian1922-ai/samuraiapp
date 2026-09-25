import { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { createProject, listProjects } from "@/server/projects";
import { createTask } from "@/server/tasks";
import { createMeeting } from "@/server/meetings";
import { ok, handleApiError, ApiError } from "@/lib/api-response";
import { logActivity, logAudit } from "@/server/activity";

const createProjectPayload = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional().default("medium"),
  tasks: z.array(z.string().trim().min(1)).optional().default([]),
});

const createTasksPayload = z.object({
  projectId: z.string().uuid().optional(),
  projectName: z.string().trim().optional(),
  tasks: z.array(z.object({
    title: z.string().trim().min(1),
    priority: z.enum(["critical", "high", "medium", "low"]).optional().default("medium"),
  })).min(1),
});

const createMeetingPayload = z.object({
  title: z.string().trim().min(2),
  projectId: z.string().uuid().optional(),
  startTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional().default(60),
  agenda: z.string().trim().optional(),
});

const executeSchema = z.object({
  type: z.enum(["create_project", "create_tasks", "create_meeting"]),
  payload: z.record(z.string(), z.unknown()),
});

// AI proposals are never executed automatically. This endpoint is only ever
// called after an explicit user confirmation click in the UI, and it
// re-validates both the payload shape and the caller's permissions before
// touching the database — exactly like any other mutation in the app.
export async function POST(req: NextRequest) {
  try {
    const { workspace, user, role } = await requireWorkspaceContext();
    assertCan(role, "ai.write_actions");

    const { type, payload } = executeSchema.parse(await req.json());

    if (type === "create_project") {
      assertCan(role, "project.create");
      const input = createProjectPayload.parse(payload);
      const project = await createProject(workspace.id, user.id, {
        name: input.name, description: input.description ?? null, priority: input.priority,
        color: "#4f46e5", startDate: null, dueDate: null, memberIds: [],
      });
      for (const title of input.tasks) {
        await createTask(workspace.id, user.id, { projectId: project.id, title, priority: "medium", tagIds: [] });
      }
      await logActivity({
        workspaceId: workspace.id, actorId: user.id, type: "ai.project_created", entityType: "project",
        entityId: project.id, projectId: project.id, message: `Samurai AI پروژه «${project.name}» را با تأیید ${user.name} ایجاد کرد.`,
      });
      await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "ai.execute_action", entityType: "project", entityId: project.id, metadata: { type } });
      return ok({ project });
    }

    if (type === "create_tasks") {
      assertCan(role, "task.create");
      const input = createTasksPayload.parse(payload);
      let projectId = input.projectId;
      if (!projectId && input.projectName) {
        const projects = await listProjects(workspace.id);
        const match = projects.find((p) => p.name.includes(input.projectName!) || input.projectName!.includes(p.name));
        projectId = match?.id;
      }
      if (!projectId) throw new ApiError("پروژه‌ای برای ایجاد این وظایف مشخص نشد. لطفاً نام پروژه را دقیق‌تر بگویید.", 400);

      const created = [];
      for (const t of input.tasks) {
        created.push(await createTask(workspace.id, user.id, { projectId, title: t.title, priority: t.priority, tagIds: [] }));
      }
      await logActivity({
        workspaceId: workspace.id, actorId: user.id, type: "ai.tasks_created", entityType: "task",
        projectId, message: `Samurai AI با تأیید ${user.name}، ${created.length} وظیفه ایجاد کرد.`,
      });
      await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "ai.execute_action", entityType: "task", metadata: { type, count: created.length } });
      return ok({ tasks: created });
    }

    if (type === "create_meeting") {
      assertCan(role, "meeting.create");
      const input = createMeetingPayload.parse(payload);
      const start = input.startTime ? new Date(input.startTime) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);

      const meeting = await createMeeting(workspace.id, user.id, {
        title: input.title, projectId: input.projectId ?? null, agenda: input.agenda ?? null,
        startTime: start.toISOString(), endTime: end.toISOString(), participantIds: [],
      });
      await logActivity({
        workspaceId: workspace.id, actorId: user.id, type: "ai.meeting_created", entityType: "meeting",
        entityId: meeting.id, message: `Samurai AI با تأیید ${user.name}، جلسه «${meeting.title}» را ایجاد کرد.`,
      });
      await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "ai.execute_action", entityType: "meeting", entityId: meeting.id, metadata: { type } });
      return ok({ meeting });
    }

    throw new ApiError("نوع عملیات پشتیبانی نمی‌شود.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
