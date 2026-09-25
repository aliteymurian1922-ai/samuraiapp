import { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { db } from "@/db";
import { aiConversations, aiMessages } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { streamSamuraiChat } from "@/ai/openai-provider";
import type { ChatMessage } from "@/ai/types";
import { fail, handleApiError } from "@/lib/api-response";

const schema = z.object({ conversationId: z.string().uuid().optional(), message: z.string().trim().min(1).max(2000) });

export async function POST(req: NextRequest) {
  try {
    const { workspace, user, role } = await requireWorkspaceContext();
    assertCan(role, "ai.use");

    const input = schema.parse(await req.json());

    let conversationId = input.conversationId;
    if (!conversationId) {
      const [conv] = await db
        .insert(aiConversations)
        .values({ workspaceId: workspace.id, userId: user.id, title: input.message.slice(0, 60) })
        .returning();
      conversationId = conv.id;
    } else {
      const existing = await db.select().from(aiConversations).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, user.id))).limit(1);
      if (!existing[0]) return fail("گفتگو یافت نشد.", 404);
    }

    const historyRows = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt))
      .limit(20);

    const history: ChatMessage[] = historyRows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    await db.insert(aiMessages).values({ conversationId, role: "user", content: input.message });

    const encoder = new TextEncoder();
    const finalConversationId = conversationId;

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "conversation", conversationId: finalConversationId }) + "\n"));

        let fullText = "";
        let proposal: unknown = null;

        try {
          for await (const event of streamSamuraiChat({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            userId: user.id,
            userRole: role,
            history,
            userMessage: input.message,
          })) {
            if (event.type === "text-delta") fullText += event.delta;
            if (event.type === "proposal") proposal = event.proposal;
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          }
        } catch {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: "خطای غیرمنتظره در Samurai AI." }) + "\n"));
        }

        const content = proposal ? JSON.stringify(proposal) : fullText || "پاسخی دریافت نشد.";
        await db.insert(aiMessages).values({
          conversationId: finalConversationId,
          role: "assistant",
          content,
          toolCalls: proposal ? [proposal as Record<string, unknown>] : [],
        });
        await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, finalConversationId));

        controller.close();
      },
    });

    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (error) {
    return handleApiError(error);
  }
}
