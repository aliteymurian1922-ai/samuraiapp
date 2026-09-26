import { NextRequest } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { assertCan } from "@/lib/permissions";
import { handleApiError, ok } from "@/lib/api-response";
import { taskRecurrenceSchema } from "@/lib/validation/task-recurrence";
import {
  disableTaskRecurrence,
  getTaskRecurrence,
  upsertTaskRecurrence,
} from "@/server/task-recurrence";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace } = await requireWorkspaceContext();
    const recurrence = await getTaskRecurrence(workspace.id, id);
    return ok({ recurrence });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role, user } = await requireWorkspaceContext();
    assertCan(role, "task.update");

    const input = taskRecurrenceSchema.parse(await req.json());
    const recurrence = await upsertTaskRecurrence(workspace.id, id, user.id, input);
    return ok({ recurrence });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceContext();
    assertCan(role, "task.update");

    const recurrence = await disableTaskRecurrence(workspace.id, id);
    return ok({ recurrence });
  } catch (error) {
    return handleApiError(error);
  }
}
