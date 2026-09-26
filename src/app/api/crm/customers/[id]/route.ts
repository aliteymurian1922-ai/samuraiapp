import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { handleApiError, ok } from "@/lib/api-response";
import { updateCustomerSchema } from "@/lib/validation/crm";
import { getCustomer360, updateCustomerProfile } from "@/server/crm-customer";
import { logActivity } from "@/server/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");

    return ok(await getCustomer360(workspace.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = updateCustomerSchema.parse(await req.json());
    const customer = await updateCustomerProfile(workspace.id, id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.customer.updated",
      entityType: "crm_contact",
      entityId: id,
      message: `${user.name} اطلاعات مشتری «${customer.name}» را به‌روزرسانی کرد.`,
    });

    return ok({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}
