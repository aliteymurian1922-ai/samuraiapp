import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getMembershipById, updateMembershipSettings, removeMembership } from "@/server/members";
import { updateMemberSchema } from "@/lib/validation/workspace";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, ApiError, NotFoundError } from "@/lib/api-response";
import { logAudit } from "@/server/activity";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  try {
    const { membershipId } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "members.manage");

    const target = await getMembershipById(membershipId);
    if (!target || target.workspaceId !== workspace.id) throw new NotFoundError("عضو یافت نشد.");
    const input = updateMemberSchema.parse(await req.json());

    if (target.role === "owner" && input.role !== undefined && input.role !== "owner") {
      throw new ApiError("نقش مالک Workspace قابل تغییر نیست.", 400);
    }

    const updated = await updateMembershipSettings(membershipId, input);
    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "member.settings_change",
      entityType: "membership",
      entityId: membershipId,
      metadata: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.weeklyCapacityMinutes !== undefined
          ? { weeklyCapacityMinutes: input.weeklyCapacityMinutes }
          : {}),
      },
    });

    return ok({ membership: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  try {
    const { membershipId } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "members.remove");

    const target = await getMembershipById(membershipId);
    if (!target || target.workspaceId !== workspace.id) throw new NotFoundError("عضو یافت نشد.");
    if (target.role === "owner") throw new ApiError("مالک Workspace قابل حذف نیست.", 400);

    await removeMembership(membershipId);
    await logAudit({ workspaceId: workspace.id, actorId: user.id, action: "member.remove", entityType: "membership", entityId: membershipId });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
