import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { listProjects, createProject, getProjectStats, getProjectHealth } from "@/server/projects";
import { createProjectSchema } from "@/lib/validation/project";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { logActivity, logAudit } from "@/server/activity";

export async function GET(req: NextRequest) {
  try {
    const { workspace } = await requireWorkspaceContext();
    const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
    const projects = await listProjects(workspace.id, { includeArchived });

    const withStats = await Promise.all(
      projects.map(async (p) => {
        const [stats, health] = await Promise.all([getProjectStats(p.id), getProjectHealth(p.id)]);
        return { ...p, stats, health };
      }),
    );

    return ok({ projects: withStats });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "project.create");

    const input = createProjectSchema.parse(await req.json());
    const project = await createProject(workspace.id, user.id, input);

    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "project.created", entityType: "project",
      entityId: project.id, projectId: project.id, message: `${user.name} پروژه «${project.name}» را ایجاد کرد.`,
    });
    await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "project.create", entityType: "project", entityId: project.id });

    return ok({ project }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
