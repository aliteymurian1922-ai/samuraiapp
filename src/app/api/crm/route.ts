import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { getCrmOverview } from "@/server/crm";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");
    const overview = await getCrmOverview(workspace.id);
    return ok(overview);
  } catch (error) {
    return handleApiError(error);
  }
}
