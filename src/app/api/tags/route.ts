import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { listWorkspaceTags, createTag } from "@/server/tasks";
import { ok, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export async function GET() {
  try {
    const { workspace } = await requireWorkspaceContext();
    const tags = await listWorkspaceTags(workspace.id);
    return ok({ tags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace } = await requireWorkspaceContext();
    const input = z.object({ name: z.string().trim().min(1).max(60), color: z.string().optional() }).parse(await req.json());
    const tag = await createTag(workspace.id, input.name, input.color);
    return ok({ tag }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
