import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getProjectById, getProjectStats, getProjectHealth } from "@/server/projects";
import { listTasks } from "@/server/tasks";
import { assertCan } from "@/lib/permissions";
import { ok, handleApiError, NotFoundError } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "report.view");

    const project = await getProjectById(id, workspace.id);
    if (!project) throw new NotFoundError("پروژه یافت نشد.");

    const [stats, health, tasks] = await Promise.all([
      getProjectStats(id), getProjectHealth(id), listTasks(workspace.id, { projectId: id }),
    ]);

    const byPriority = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1;
      return acc;
    }, {});

    const byStatus = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.statusName] = (acc[t.statusName] ?? 0) + 1;
      return acc;
    }, {});

    return ok({ project, stats, health, byPriority, byStatus, taskCount: tasks.length });
  } catch (error) {
    return handleApiError(error);
  }
}
