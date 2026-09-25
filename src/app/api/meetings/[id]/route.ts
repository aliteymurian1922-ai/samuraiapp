import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getMeetingDetail, updateMeetingNotes } from "@/server/meetings";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace } = await requireWorkspaceContext();
    const meeting = await getMeetingDetail(id, workspace.id);
    if (!meeting) throw new NotFoundError("جلسه یافت نشد.");
    return ok({ meeting });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace } = await requireWorkspaceContext();
    const meeting = await getMeetingDetail(id, workspace.id);
    if (!meeting) throw new NotFoundError("جلسه یافت نشد.");

    const input = z.object({ notes: z.string().trim().max(8000) }).parse(await req.json());
    const updated = await updateMeetingNotes(id, input.notes);
    return ok({ meeting: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
