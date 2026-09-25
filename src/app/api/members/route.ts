import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { listWorkspaceMembers, findUserByEmail, addMembership } from "@/server/members";
import { inviteMemberSchema } from "@/lib/validation/workspace";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, ApiError } from "@/lib/api-response";
import { createNotification, logAudit } from "@/server/activity";

export async function GET() {
  try {
    const { workspace } = await requireWorkspaceContext();
    const members = await listWorkspaceMembers(workspace.id);
    return ok({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "members.invite");

    const input = inviteMemberSchema.parse(await req.json());
    const invitedUser = await findUserByEmail(input.email);
    if (!invitedUser) {
      throw new ApiError("کاربری با این ایمیل در سامورایی ثبت‌نام نکرده است. از او بخواهید ابتدا ثبت‌نام کند.", 404);
    }

    const membership = await addMembership(workspace.id, invitedUser.id, input.role);
    await createNotification({
      workspaceId: workspace.id,
      userId: invitedUser.id,
      type: "system",
      title: "به Workspace جدید اضافه شدید",
      body: `${user.name} شما را به ${workspace.name} اضافه کرد.`,
      priority: "important",
    });
    await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "member.invite", entityType: "membership", entityId: membership.id });

    return ok({ membership }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
