import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { ok, handleApiError } from "@/lib/api-response";

// NOTE: No transactional-email provider is configured for this project yet.
// To avoid a "fake" integration, we return the reset link directly in the
// API response (dev/demo behavior) instead of pretending an email was sent.
// Wiring a real provider (Resend/SendGrid) later only requires sending the
// same link inside sendResetEmail().
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = forgotPasswordSchema.parse(body);

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
