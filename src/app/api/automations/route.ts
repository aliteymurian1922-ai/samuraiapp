import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createAutomationRuleSchema } from "@/lib/validation/automations";
import {
  createAutomationRule,
  listAutomationRules,
  listAutomationRuns,
} from "@/server/automations";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "automation.view");

    const [rules, runs] = await Promise.all([
      listAutomationRules(workspace.id),
      listAutomationRuns(workspace.id, 30),
    ]);

    return ok({ rules, runs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "automation.manage");

    const input = createAutomationRuleSchema.parse(await req.json());
    const rule = await createAutomationRule(workspace.id, user.id, input);

    return ok({ rule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
