import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createLeadSchema } from "@/lib/validation/crm";
import { createLead, listLeads } from "@/server/crm";
import { logActivity } from "@/server/activity";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    return ok({ leads: await listLeads(workspace.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.create");

    const input = createLeadSchema.parse(await req.json());
    const lead = await createLead(workspace.id, user.id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.lead.created",
      entityType: "crm_lead",
      entityId: lead.id,
      message: `${user.name} سرنخ «${lead.name}» را ثبت کرد.`,
    });

    return ok({ lead }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
