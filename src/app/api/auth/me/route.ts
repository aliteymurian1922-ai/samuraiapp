import { getCurrentUser } from "@/lib/auth/session";
import { getUserWorkspaces } from "@/lib/auth/context";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ user: null, workspaces: [] });
    const workspaces = await getUserWorkspaces(user.id);
    return ok({ user, workspaces });
  } catch (error) {
    return handleApiError(error);
  }
}
