import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { convertDealToProjectSchema } from "@/lib/validation/crm";
import { convertDealToProject } from "@/server/crm";
import { logActivity, logAudit } from "@/server/activity";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "project.create");
    assertCan(role, "crm.update");

    const body = await req.json().catch(() => ({}));
    const input = convertDealToProjectSchema.parse(body);
    const project = await convertDealToProject(workspace.id, user.id, id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.deal.project_created",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      message: `${user.name} پروژه «${project.name}» را از فرصت فروش ایجاد کرد.`,
    });

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "crm.deal.convert_to_project",
      entityType: "crm_deal",
      entityId: id,
      metadata: { projectId: project.id },
    });

    return ok({ project }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
