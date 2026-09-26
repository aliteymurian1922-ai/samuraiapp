import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ApiError, handleApiError, ok } from "@/lib/api-response";
import {
  crmCustomFieldEntityValues,
  setCrmCustomFieldValuesSchema,
  type CrmCustomFieldEntity,
} from "@/lib/validation/crm-custom-fields";
import {
  getCrmCustomFieldValues,
  setCrmCustomFieldValues,
} from "@/server/crm-custom-fields";

export async function GET(req: NextRequest) {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");

    const rawEntityType = req.nextUrl.searchParams.get("entityType");
    const entityId = req.nextUrl.searchParams.get("entityId");

    if (!rawEntityType || !crmCustomFieldEntityValues.includes(rawEntityType as CrmCustomFieldEntity) || !entityId) {
      throw new ApiError("نوع و شناسه رکورد لازم است.", 400);
    }

    const fields = await getCrmCustomFieldValues(
      workspace.id,
      rawEntityType as CrmCustomFieldEntity,
      entityId,
    );

    return ok({ fields });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.update");

    const input = setCrmCustomFieldValuesSchema.parse(await req.json());
    const values = await setCrmCustomFieldValues(workspace.id, user.id, input);

    return ok({ values });
  } catch (error) {
    return handleApiError(error);
  }
}
