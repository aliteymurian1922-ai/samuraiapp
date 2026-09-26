import { z } from "zod";

export const salesTargetMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "ماه باید با فرمت YYYY-MM باشد.");

export const updateSalesTargetsSchema = z.object({
  month: salesTargetMonthSchema,
  workspaceTarget: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  memberTargets: z.array(
    z.object({
      userId: z.string().uuid(),
      targetValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    }),
  ).max(500),
});

export type UpdateSalesTargetsInput = z.infer<typeof updateSalesTargetsSchema>;
