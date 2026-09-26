import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { updateDealSchema } from "@/lib/validation/crm";
import { updateDeal } from "@/server/crm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = updateDealSchema.parse(await req.json());
    const deal = await updateDeal(workspace.id, id, input);
    return ok({ deal });
  } catch (error) {
    return handleApiError(error);
  }
}
