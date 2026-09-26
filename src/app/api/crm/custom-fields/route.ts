import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { handleApiError, ok } from "@/lib/api-response";
import {
  createCrmCustomFieldSchema,
  crmCustomFieldEntityValues,
  type CrmCustomFieldEntity,
} from "@/lib/validation/crm-custom-fields";
import {
  createCrmCustomField,
  listCrmCustomFields,
} from "@/server/crm-custom-fields";

export async function GET(req: NextRequest) {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "crm.view");

    const rawEntityType = req.nextUrl.searchParams.get("entityType");
    const entityType = rawEntityType && crmCustomFieldEntityValues.includes(rawEntityType as CrmCustomFieldEntity)
      ? (rawEntityType as CrmCustomFieldEntity)
      : undefined;
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";

    const fields = await listCrmCustomFields(workspace.id, entityType, includeInactive);
    return ok({ fields });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "crm.fields.manage");

    const input = createCrmCustomFieldSchema.parse(await req.json());
    const field = await createCrmCustomField(workspace.id, user.id, input);

    return ok({ field }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
