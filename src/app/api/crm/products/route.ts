import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createCrmProductSchema } from "@/lib/validation/crm";
import { createCrmProduct, listCrmProducts } from "@/server/crm";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    return ok({ products: await listCrmProducts(workspace.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.create");
    const input = createCrmProductSchema.parse(await req.json());
    const product = await createCrmProduct(workspace.id, input);
    return ok({ product }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
