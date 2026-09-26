import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createDealSchema } from "@/lib/validation/crm";
import { createDeal, ensureDefaultPipeline, listDeals } from "@/server/crm";
import { logActivity } from "@/server/activity";
import { runCrmAutomations } from "@/server/automations";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    const pipeline = await ensureDefaultPipeline(workspace.id);
    return ok({ deals: await listDeals(workspace.id, pipeline.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.create");

    const input = createDealSchema.parse(await req.json());
    const deal = await createDeal(workspace.id, user.id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.deal.created",
      entityType: "crm_deal",
      entityId: deal.id,
      message: `${user.name} فرصت فروش «${deal.title}» را ایجاد کرد.`,
    });

    await runCrmAutomations({
      workspaceId: workspace.id,
      actorId: user.id,
      trigger: "deal_created",
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

    return ok({ deal }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
