import { destroyCurrentSession } from "@/lib/auth/session";
import { ok, handleApiError } from "@/lib/api-response";

export async function POST() {
  try {
    await destroyCurrentSession();
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
