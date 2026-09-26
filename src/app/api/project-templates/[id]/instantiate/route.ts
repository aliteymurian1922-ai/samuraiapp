import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { instantiateProjectTemplateSchema } from "@/lib/validation/project-template";
import { instantiateProjectTemplate } from "@/server/project-templates";
import { logActivity } from "@/server/activity";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "project.create");

    const input = instantiateProjectTemplateSchema.parse(await req.json().catch(() => ({})));
    const project = await instantiateProjectTemplate(workspace.id, user.id, id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "project.created_from_template",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      message: `${user.name} پروژه «${project.name}» را از قالب ساخت.`,
    });

    return ok({ project }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
