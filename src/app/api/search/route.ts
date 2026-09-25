import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { globalSearch } from "@/server/search";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { workspace } = await requireWorkspaceContext();
    const query = req.nextUrl.searchParams.get("q") ?? "";
    const results = await globalSearch(workspace.id, query);
    return ok({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
