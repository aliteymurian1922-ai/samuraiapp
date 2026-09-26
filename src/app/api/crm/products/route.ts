import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createProductSchema } from "@/lib/validation/crm";
import { createProduct, listProducts } from "@/server/crm";
import { logActivity } from "@/server/activity";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    return ok({ products: await listProducts(workspace.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.create");

    const input = createProductSchema.parse(await req.json());
    const product = await createProduct(workspace.id, input);

    await logActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      type: "crm.product.created",
      entityType: "crm_product",
      entityId: product.id,
      message: `${user.name} محصول یا خدمت «${product.name}» را ثبت کرد.`,
    });

    return ok({ product }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
