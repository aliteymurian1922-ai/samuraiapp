import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { updateLeadSchema } from "@/lib/validation/crm";
import { updateLead } from "@/server/crm";
import { runCrmAutomations } from "@/server/automations";
import { getLead360 } from "@/server/crm-lead";
import { logActivity } from "@/server/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");

    return ok(await getLead360(workspace.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = updateLeadSchema.parse(await req.json());
    const lead = await updateLead(workspace.id, id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.lead.updated",
      entityType: "crm_lead",
      entityId: id,
      message: `${user.name} اطلاعات سرنخ «${lead.name}» را به‌روزرسانی کرد.`,
    });

    if (input.status !== undefined) {
      await runCrmAutomations({
        workspaceId: workspace.id,
        actorId: user.id,
        trigger: "lead_status_changed",
        entityType: "crm_lead",
        entityId: lead.id,
      });
    }

    return ok({ lead });
  } catch (error) {
    return handleApiError(error);
  }
}
