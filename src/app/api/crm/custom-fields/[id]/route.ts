import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { handleApiError, ok } from "@/lib/api-response";
import { updateCrmCustomFieldSchema } from "@/lib/validation/crm-custom-fields";
import { updateCrmCustomField } from "@/server/crm-custom-fields";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.fields.manage");

    const input = updateCrmCustomFieldSchema.parse(await req.json());
    const field = await updateCrmCustomField(workspace.id, id, input);

    return ok({ field });
  } catch (error) {
    return handleApiError(error);
  }
}
