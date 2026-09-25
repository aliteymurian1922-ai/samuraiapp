import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { listMeetings, createMeeting } from "@/server/meetings";
import { createMeetingSchema } from "@/lib/validation/meeting";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";
import { logActivity, createNotification } from "@/server/activity";

export async function GET(req: NextRequest) {
  try {
    const { workspace } = await requireWorkspaceContext();
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const meetings = await listMeetings(
      workspace.id,
      from && to ? { from: new Date(from), to: new Date(to) } : undefined,
    );
    return ok({ meetings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "meeting.create");

    const input = createMeetingSchema.parse(await req.json());
    const meeting = await createMeeting(workspace.id, user.id, input);

    await logActivity({
      workspaceId: workspace.id, actorId: user.id, type: "meeting.created", entityType: "meeting",
      entityId: meeting.id, message: `${user.name} جلسه «${meeting.title}» را ایجاد کرد.`,
    });

    for (const participantId of input.participantIds) {
      if (participantId === user.id) continue;
      await createNotification({
        workspaceId: workspace.id, userId: participantId, type: "system",
        title: "دعوت به جلسه جدید", body: meeting.title, priority: "important", link: "/app/meetings",
      });
    }

    return ok({ meeting }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
