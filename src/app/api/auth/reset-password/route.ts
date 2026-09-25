import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { ok, handleApiError, ApiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = resetPasswordSchema.parse(body);
    const tokenHash = createHash("sha256").update(input.token).digest("hex");

    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, tokenHash), gt(passwordResetTokens.expiresAt, new Date()), isNull(passwordResetTokens.usedAt)))
      .limit(1);

    const record = rows[0];
    if (!record) throw new ApiError("لینک بازیابی نامعتبر یا منقضی شده است.", 400);

    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, record.userId));
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, record.id));
      // Password changes invalidate all existing sessions for this user.
      await tx.delete(sessions).where(eq(sessions.userId, record.userId));
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
