import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createUserSession } from "@/lib/auth/session";
import { ok, handleApiError, ApiError } from "@/lib/api-response";
import { logAudit } from "@/server/activity";
import { clearRateLimit, enforceRateLimit, getRequestIp } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (ip) {
      await enforceRateLimit({
        scope: "auth.login.ip",
        identifier: ip,
        maxAttempts: 20,
        windowMs: 15 * 60 * 1000,
        blockMs: 30 * 60 * 1000,
      });
    }

    const body = await req.json();
    const input = loginSchema.parse(body);

    await enforceRateLimit({
      scope: "auth.login.email",
      identifier: input.email,
      maxAttempts: 6,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
    });

    const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const user = rows[0];
    if (!user) throw new ApiError("ایمیل یا رمز عبور اشتباه است.", 401);

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw new ApiError("ایمیل یا رمز عبور اشتباه است.", 401);

    await createUserSession(user.id, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
    await clearRateLimit("auth.login.email", input.email);
    await logAudit({ workspaceId: null, actorId: user.id, action: "user.login", entityType: "user", entityId: user.id });

    return ok({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    return handleApiError(error);
  }
}
