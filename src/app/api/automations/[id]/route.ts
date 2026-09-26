import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";
import { updateAutomationRuleSchema } from "@/lib/validation/automation";
import { updateAutomationRule } from "@/server/automations";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "settings.manage");

    const input = updateAutomationRuleSchema.parse(await req.json());
    const rule = await updateAutomationRule(workspace.id, id, input);
    if (!rule) throw new NotFoundError("قانون اتوماسیون یافت نشد.");

    return ok({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}
