import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import {
  getProjectById, updateProject, deleteProject, getProjectStats, getProjectHealth, getProjectMembers,
} from "@/server/projects";
import { listProjectStatuses } from "@/server/tasks";
import { updateProjectSchema } from "@/lib/validation/project";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";
import { logActivity, logAudit } from "@/server/activity";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace } = await requireWorkspaceContext();
    const project = await getProjectById(id, workspace.id);
    if (!project) throw new NotFoundError("پروژه یافت نشد.");

    const [stats, health, members, statuses] = await Promise.all([
      getProjectStats(id), getProjectHealth(id), getProjectMembers(id), listProjectStatuses(id),
    ]);

    return ok({ project, stats, health, members, statuses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "project.update");

    const existing = await getProjectById(id, workspace.id);
    if (!existing) throw new NotFoundError("پروژه یافت نشد.");

    const input = updateProjectSchema.parse(await req.json());
    const project = await updateProject(id, input);

    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "project.updated", entityType: "project",
      entityId: id, projectId: id, message: `${user.name} پروژه «${project.name}» را به‌روزرسانی کرد.`,
    });

    return ok({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "project.delete");

    const existing = await getProjectById(id, workspace.id);
    if (!existing) throw new NotFoundError("پروژه یافت نشد.");

    await deleteProject(id);
    await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "project.delete", entityType: "project", entityId: id });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
