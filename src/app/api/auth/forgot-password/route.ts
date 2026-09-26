import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { ok, handleApiError } from "@/lib/api-response";
import { enforceRateLimit, getRequestIp } from "@/lib/security/rate-limit";
import { getApplicationUrl, sendPasswordResetEmail } from "@/server/email";

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

    const genericMessage = "اگر این ایمیل ثبت شده باشد، لینک بازیابی برای آن ارسال می‌شود.";
    const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const user = rows[0];

    if (!user) {
      return ok({ message: genericMessage, resetUrl: null });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const [tokenRecord] = await db
      .insert(passwordResetTokens)
      .values({ userId: user.id, tokenHash, expiresAt })
      .returning({ id: passwordResetTokens.id });

    const resetPath = `/reset-password?token=${rawToken}`;
    const appUrl = getApplicationUrl(req.nextUrl.origin);
    const absoluteResetUrl = appUrl ? `${appUrl}${resetPath}` : null;

    let delivered = false;
    if (absoluteResetUrl) {
      const delivery = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: absoluteResetUrl,
      });
      delivered = delivery.sent;
    }

    if (process.env.NODE_ENV === "production" && !delivered) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenRecord.id));
      console.error("[auth] password reset email was not delivered; token revoked");
    }

    return ok({
      message: genericMessage,
      resetUrl: process.env.NODE_ENV === "production" ? null : resetPath,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
