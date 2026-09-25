import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/context";
import { markNotificationRead } from "@/server/activity";
import { ok, handleApiError } from "@/lib/api-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await markNotificationRead(id, user.id);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
