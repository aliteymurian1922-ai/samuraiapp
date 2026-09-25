import { requireWorkspaceContext } from "@/lib/auth/context";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const { workspace, user, role } = await requireWorkspaceContext();
    assertCan(role, "ai.use");
    const conversations = await db
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.workspaceId, workspace.id), eq(aiConversations.userId, user.id)))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(30);
    return ok({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}
