import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { updateDealSchema } from "@/lib/validation/crm";
import { updateDeal } from "@/server/crm";
import { runCrmAutomations } from "@/server/automations";
import { getDeal360 } from "@/server/crm-deal";
import { logActivity } from "@/server/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");

    return ok(await getDeal360(workspace.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = updateDealSchema.parse(await req.json());
    const deal = await updateDeal(workspace.id, id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.deal.updated",
      entityType: "crm_deal",
      entityId: id,
      message: `${user.name} فرصت فروش «${deal.title}» را به‌روزرسانی کرد.`,
    });

    if (input.stageId !== undefined) {
      await runCrmAutomations({
        workspaceId: workspace.id,
        actorId: user.id,
        trigger: "deal_stage_changed",
        entityType: "crm_deal",
        entityId: deal.id,
      });

      if (deal.status === "won" || deal.status === "lost") {
        await runCrmAutomations({
          workspaceId: workspace.id,
          actorId: user.id,
          trigger: deal.status === "won" ? "deal_won" : "deal_lost",
          entityType: "crm_deal",
          entityId: deal.id,
        });
      }
    }

    return ok({ deal });
  } catch (error) {
    return handleApiError(error);
  }
}
