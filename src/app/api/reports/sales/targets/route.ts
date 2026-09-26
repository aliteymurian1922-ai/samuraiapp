import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { handleApiError, ok } from "@/lib/api-response";
import {
  salesTargetMonthSchema,
  updateSalesTargetsSchema,
} from "@/lib/validation/sales-targets";
import {
  currentMonthKey,
  getSalesTargets,
  updateSalesTargets,
} from "@/server/sales-targets";
import { logAudit } from "@/server/activity";

export async function GET(req: NextRequest) {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "report.view");

    const rawMonth = req.nextUrl.searchParams.get("month") ?? currentMonthKey();
    const month = salesTargetMonthSchema.parse(rawMonth);
    const targets = await getSalesTargets(workspace.id, month);

    return ok({ targets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.targets.manage");

    const input = updateSalesTargetsSchema.parse(await req.json());
    const targets = await updateSalesTargets(workspace.id, user.id, input);

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "crm.sales_targets.update",
      entityType: "crm_sales_target",
      metadata: {
        month: input.month,
        workspaceTarget: input.workspaceTarget,
        members: input.memberTargets.length,
      },
    });

    return ok({ targets });
  } catch (error) {
    return handleApiError(error);
  }
}
