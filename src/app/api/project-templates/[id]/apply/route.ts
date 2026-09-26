import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { applyProjectTemplateSchema } from "@/lib/validation/project-template";
import { applyProjectTemplate } from "@/server/project-templates";
import { logActivity, logAudit } from "@/server/activity";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "project.create");

    const input = applyProjectTemplateSchema.parse(await req.json().catch(() => ({})));
    const project = await applyProjectTemplate(workspace.id, user.id, id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "project.created_from_template",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      message: `${user.name} پروژه «${project.name}» را از قالب ساخت.`,
    });
    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "project.create_from_template",
      entityType: "project",
      entityId: project.id,
      metadata: { templateId: id },
    });

    return ok({ project }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
