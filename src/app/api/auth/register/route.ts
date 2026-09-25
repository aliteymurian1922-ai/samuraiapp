import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { createUserSession } from "@/lib/auth/session";
import { ok, fail, handleApiError, ApiError } from "@/lib/api-response";
import { logAudit } from "@/server/activity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = registerSchema.parse(body);

    const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing[0]) {
      throw new ApiError("این ایمیل قبلاً ثبت شده است.", 409);
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .returning();

    await createUserSession(user.id, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    await logAudit({ workspaceId: null, actorId: user.id, action: "user.register", entityType: "user", entityId: user.id });

    return ok({ id: user.id, name: user.name, email: user.email }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
