import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { updateProductSchema } from "@/lib/validation/crm";
import { updateProduct } from "@/server/crm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = updateProductSchema.parse(await req.json());
    const product = await updateProduct(workspace.id, id, input);
    return ok({ product });
  } catch (error) {
    return handleApiError(error);
  }
}
