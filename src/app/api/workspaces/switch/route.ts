import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, getUserWorkspaces } from "@/lib/auth/context";
import { setActiveWorkspaceCookie } from "@/lib/auth/session";
import { ok, handleApiError, ApiError } from "@/lib/api-response";

const schema = z.object({ workspaceId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { workspaceId } = schema.parse(await req.json());

    const workspaces = await getUserWorkspaces(user.id);
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!target) throw new ApiError("شما عضو این Workspace نیستید.", 403);

    await setActiveWorkspaceCookie(workspaceId);
    return ok({ workspace: target });
  } catch (error) {
    return handleApiError(error);
  }
}
