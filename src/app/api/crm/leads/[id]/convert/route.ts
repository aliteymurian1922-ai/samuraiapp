import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { convertLeadToDeal } from "@/server/crm";
import { logActivity } from "@/server/activity";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.create");

    const result = await convertLeadToDeal(workspace.id, user.id, id);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.lead.converted",
      entityType: "crm_deal",
      entityId: result.deal.id,
      message: `${user.name} یک سرنخ را به فرصت فروش تبدیل کرد.`,
    });

    return ok(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
