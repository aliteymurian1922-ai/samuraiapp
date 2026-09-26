import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { createProjectTemplateSchema } from "@/lib/validation/project-template";
import { createProjectTemplate, listProjectTemplates } from "@/server/project-templates";

export async function GET() {
  try {
    const { workspace } = await requireWorkspaceContext();
    return ok({ templates: await listProjectTemplates(workspace.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "project.create");

    const input = createProjectTemplateSchema.parse(await req.json());
    const template = await createProjectTemplate(workspace.id, user.id, input);

    return ok({ template }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
