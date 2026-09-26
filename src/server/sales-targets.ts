import "server-only";

import { db } from "@/db";
import { crmSalesTargets, memberships, users } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ApiError } from "@/lib/api-response";
import type { UpdateSalesTargetsInput } from "@/lib/validation/sales-targets";

export function monthStartFromKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
}

export function currentMonthKey(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function getSalesTargets(workspaceId: string, month: string) {
  const periodStart = monthStartFromKey(month);

  const [members, targets] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(asc(users.name)),
    db
      .select({
        ownerKey: crmSalesTargets.ownerKey,
        userId: crmSalesTargets.userId,
        targetValue: crmSalesTargets.targetValue,
      })
      .from(crmSalesTargets)
      .where(
        and(
          eq(crmSalesTargets.workspaceId, workspaceId),
          eq(crmSalesTargets.periodStart, periodStart),
        ),
      ),
  ]);

  const targetMap = new Map(targets.map((target) => [target.ownerKey, Number(target.targetValue)]));

  return {
    month,
    workspaceTarget: targetMap.get("__workspace__") ?? 0,
    members: members.map((member) => ({
      ...member,
      targetValue: targetMap.get(member.userId) ?? 0,
    })),
  };
}

export async function updateSalesTargets(
  workspaceId: string,
  actorId: string,
  input: UpdateSalesTargetsInput,
) {
  const periodStart = monthStartFromKey(input.month);
  const memberIds = [...new Set(input.memberTargets.map((item) => item.userId))];

  if (memberIds.length > 0) {
    const validMembers = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          inArray(memberships.userId, memberIds),
        ),
      );

    if (validMembers.length !== memberIds.length) {
      throw new ApiError("یک یا چند عضو انتخاب‌شده متعلق به این Workspace نیستند.", 400);
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(crmSalesTargets)
      .values({
        workspaceId,
        ownerKey: "__workspace__",
        userId: null,
        periodStart,
        targetValue: input.workspaceTarget,
        createdBy: actorId,
      })
      .onConflictDoUpdate({
        target: [
          crmSalesTargets.workspaceId,
          crmSalesTargets.periodStart,
          crmSalesTargets.ownerKey,
        ],
        set: {
          targetValue: input.workspaceTarget,
          updatedAt: new Date(),
        },
      });

    for (const member of input.memberTargets) {
      await tx
        .insert(crmSalesTargets)
        .values({
          workspaceId,
          ownerKey: member.userId,
          userId: member.userId,
          periodStart,
          targetValue: member.targetValue,
          createdBy: actorId,
        })
        .onConflictDoUpdate({
          target: [
            crmSalesTargets.workspaceId,
            crmSalesTargets.periodStart,
            crmSalesTargets.ownerKey,
          ],
          set: {
            targetValue: member.targetValue,
            updatedAt: new Date(),
          },
        });
    }
  });

  return getSalesTargets(workspaceId, input.month);
}
