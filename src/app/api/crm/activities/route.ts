import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createCrmActivitySchema } from "@/lib/validation/crm";
import { createCrmActivity, listCrmActivities } from "@/server/crm";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    return ok({ activities: await listCrmActivities(workspace.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.create");
    const input = createCrmActivitySchema.parse(await req.json());
    const activity = await createCrmActivity(workspace.id, user.id, input);
    return ok({ activity }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
