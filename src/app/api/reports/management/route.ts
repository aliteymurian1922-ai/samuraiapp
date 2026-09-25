import { requireWorkspaceContext } from "@/lib/auth/context";
import { buildManagementReport } from "@/server/reports";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "report.view");
    const report = await buildManagementReport(workspace.id);
    return ok({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
