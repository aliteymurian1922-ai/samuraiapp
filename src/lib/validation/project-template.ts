import { z } from "zod";
import { priorityValues } from "@/lib/validation/project";

export const templateTaskSchema = z.object({
  title: z.string().trim().min(1).max(220),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(priorityValues).default("medium"),
  dueOffsetDays: z.number().int().min(0).max(3650).optional().nullable(),
  estimatedMinutes: z.number().int().min(0).max(100000).optional().nullable(),
});

export const createProjectTemplateSchema = z.object({
  name: z.string().trim().min(2, "نام قالب را وارد کنید.").max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  color: z.string().trim().max(20).default("#4f46e5"),
  defaultPriority: z.enum(priorityValues).default("medium"),
  defaultDurationDays: z.number().int().min(1).max(3650).optional().nullable(),
  tasks: z.array(templateTaskSchema).min(1, "حداقل یک وظیفه برای قالب تعریف کنید.").max(100),
});
export type CreateProjectTemplateInput = z.infer<typeof createProjectTemplateSchema>;

export const applyProjectTemplateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string().uuid()).default([]),
});
export type ApplyProjectTemplateInput = z.infer<typeof applyProjectTemplateSchema>;
