import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createAutomationRuleSchema } from "@/lib/validation/automation";
import { createAutomationRule, listAutomationRules, listAutomationRuns } from "@/server/automations";
import { logAudit } from "@/server/activity";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "settings.manage");
    const [rules, runs] = await Promise.all([
      listAutomationRules(workspace.id),
      listAutomationRuns(workspace.id, 20),
    ]);
    return ok({ rules, runs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "settings.manage");

    const input = createAutomationRuleSchema.parse(await req.json());
    const rule = await createAutomationRule(workspace.id, user.id, input);

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "automation.create",
      entityType: "automation_rule",
      entityId: rule.id,
      metadata: { triggerType: rule.triggerType, actionType: rule.actionType },
    });

    return ok({ rule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
