import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { updateLeadSchema } from "@/lib/validation/crm";
import { updateLead } from "@/server/crm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = updateLeadSchema.parse(await req.json());
    const lead = await updateLead(workspace.id, id, input);
    return ok({ lead });
  } catch (error) {
    return handleApiError(error);
  }
}
