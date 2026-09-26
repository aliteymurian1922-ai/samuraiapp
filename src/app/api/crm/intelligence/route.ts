import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { handleApiError, ok } from "@/lib/api-response";
import { getCrmIntelligence } from "@/server/crm-intelligence";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");

    return ok(await getCrmIntelligence(workspace.id));
  } catch (error) {
    return handleApiError(error);
  }
}
