import { requireWorkspaceContext } from "@/lib/auth/context";
import { getWorkspaceWorkload, getTeamTimeReport } from "@/server/analytics";
import { listWorkspaceMembers, getMemberTaskCounts } from "@/server/members";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "report.view");

    const [members, workload, timeReport] = await Promise.all([
      listWorkspaceMembers(workspace.id),
      getWorkspaceWorkload(workspace.id),
      getTeamTimeReport(workspace.id),
    ]);

    const detailed = await Promise.all(
      members.map(async (m) => ({
        ...m,
        counts: await getMemberTaskCounts(m.userId, workspace.id),
        workload: workload.find((w) => w.id === m.userId) ?? null,
        totalMinutesTracked: timeReport.find((t) => t.userId === m.userId)?.totalMinutes ?? 0,
      })),
    );

    return ok({ members: detailed });
  } catch (error) {
    return handleApiError(error);
  }
}
