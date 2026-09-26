import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { updateCrmActivitySchema } from "@/lib/validation/crm";
import { updateCrmActivity } from "@/server/crm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.update");
    const input = updateCrmActivitySchema.parse(await req.json());
    const activity = await updateCrmActivity(workspace.id, id, input);
    return ok({ activity });
  } catch (error) {
    return handleApiError(error);
  }
}
