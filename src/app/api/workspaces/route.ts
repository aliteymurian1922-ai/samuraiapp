import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/context";
import { getUserWorkspaces } from "@/lib/auth/context";
import { createWorkspaceSchema } from "@/lib/validation/workspace";
import { createWorkspaceWithOwner } from "@/server/workspace";
import { setActiveWorkspaceCookie } from "@/lib/auth/session";
import { ok, handleApiError } from "@/lib/api-response";
import { logAudit } from "@/server/activity";

export async function GET() {
  try {
    const user = await requireUser();
    const workspaces = await getUserWorkspaces(user.id);
    return ok({ workspaces });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = createWorkspaceSchema.parse(body);

    const workspace = await createWorkspaceWithOwner(user.id, input);
    await setActiveWorkspaceCookie(workspace.id);
    await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "workspace.create", entityType: "workspace", entityId: workspace.id });

    return ok({ workspace }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
