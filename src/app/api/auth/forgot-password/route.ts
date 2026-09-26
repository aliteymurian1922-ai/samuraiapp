import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { ok, handleApiError } from "@/lib/api-response";
import { enforceRateLimit, getRequestIp } from "@/lib/security/rate-limit";

// A transactional-email provider is not configured yet.
// Development may expose the reset URL; production deliberately never does.
export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (ip) {
      await enforceRateLimit({
        scope: "auth.forgot.ip",
        identifier: ip,
        maxAttempts: 10,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
      });
    }

    const body = await req.json();
    const input = forgotPasswordSchema.parse(body);

    await enforceRateLimit({
      scope: "auth.forgot.email",
      identifier: input.email,
      maxAttempts: 4,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });

    const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const user = rows[0];

    if (!user) {
      // Do not leak whether the email exists.
      return ok({ message: "اگر این ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود.", resetUrl: null });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });

    const resetUrl = `/reset-password?token=${rawToken}`;

    return ok({
      message: "لینک بازیابی رمز عبور ایجاد شد (چون سرویس ایمیل تنظیم نشده، لینک مستقیم نمایش داده می‌شود).",
      resetUrl: process.env.NODE_ENV === "production" ? null : resetUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
