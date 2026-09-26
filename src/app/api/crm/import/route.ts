import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { handleApiError, ok } from "@/lib/api-response";
import { crmImportSchema } from "@/lib/validation/crm-import";
import { importCrmRows } from "@/server/crm-import";
import { logAudit } from "@/server/activity";

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.import");

    const input = crmImportSchema.parse(await req.json());
    const result = await importCrmRows(workspace.id, user.id, input);

    if (!input.dryRun) {
      await logAudit({
        workspaceId: workspace.id,
        actorId: user.id,
        action: "crm.import",
        entityType: input.entityType === "lead" ? "crm_lead" : "crm_contact",
        metadata: {
          imported: result.imported,
          total: result.summary.total,
          duplicates: result.summary.duplicates,
          invalid: result.summary.invalid,
        },
      });
    }

    return ok({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
