import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { replaceDealProductsSchema } from "@/lib/validation/crm";
import { getDealProducts, replaceDealProducts } from "@/server/crm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    return ok({ items: await getDealProducts(workspace.id, id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = replaceDealProductsSchema.parse(await req.json());
    return ok({ items: await replaceDealProducts(workspace.id, id, input.items) });
  } catch (error) {
    return handleApiError(error);
  }
}
