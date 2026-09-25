import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { db } from "@/db";
import { aiMessages, aiConversations } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireWorkspaceContext();

    const conv = await db.select().from(aiConversations).where(and(eq(aiConversations.id, id), eq(aiConversations.userId, user.id))).limit(1);
    if (!conv[0]) throw new NotFoundError("گفتگو یافت نشد.");

    const messages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(asc(aiMessages.createdAt));
    return ok({ conversation: conv[0], messages });
  } catch (error) {
    return handleApiError(error);
  }
}
