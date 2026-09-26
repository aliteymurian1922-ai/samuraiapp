import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { buildSalesForecast } from "@/server/sales-forecast";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "report.view");

    return ok({ report: await buildSalesForecast(workspace.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
