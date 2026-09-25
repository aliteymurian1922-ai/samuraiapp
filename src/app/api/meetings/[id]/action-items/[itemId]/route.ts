import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { toggleActionItem } from "@/server/meetings";
import { ok, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    await requireWorkspaceContext();
    const input = z.object({ isDone: z.boolean() }).parse(await req.json());
    const item = await toggleActionItem(itemId, input.isDone);
    return ok({ actionItem: item });
  } catch (error) {
    return handleApiError(error);
  }
}
