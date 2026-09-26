import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createCustomerSchema } from "@/lib/validation/crm";
import { createCustomer, listCustomers } from "@/server/crm";
import { logActivity } from "@/server/activity";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    return ok({ customers: await listCustomers(workspace.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.create");

    const input = createCustomerSchema.parse(await req.json());
    const customer = await createCustomer(workspace.id, user.id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.customer.created",
      entityType: "crm_contact",
      entityId: customer.id,
      message: `${user.name} مشتری «${customer.name}» را ثبت کرد.`,
    });

    return ok({ customer }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
