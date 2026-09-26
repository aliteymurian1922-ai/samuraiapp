import { z } from "zod";

export const taskViewFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  overdue: z.boolean().optional(),
});

export const createTaskSavedViewSchema = z.object({
  name: z.string().trim().min(2, "نام View را وارد کنید.").max(120),
  filters: taskViewFiltersSchema,
  isDefault: z.boolean().default(false),
});

export type CreateTaskSavedViewInput = z.infer<typeof createTaskSavedViewSchema>;
