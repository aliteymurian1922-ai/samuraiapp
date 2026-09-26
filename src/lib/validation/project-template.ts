import { z } from "zod";

const priority = z.enum(["critical", "high", "medium", "low"]);

export const createProjectTemplateSchema = z.object({
  name: z.string().trim().min(2, "نام قالب را وارد کنید.").max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  color: z.string().trim().max(20).default("#4f46e5"),
  defaultPriority: priority.default("medium"),
  defaultDurationDays: z.number().int().min(1).max(365).optional().nullable(),
  tasks: z.array(z.object({
    title: z.string().trim().min(2).max(220),
    description: z.string().trim().max(2000).optional().nullable(),
    priority: priority.default("medium"),
    dueOffsetDays: z.number().int().min(0).max(365).optional().nullable(),
    estimatedMinutes: z.number().int().min(1).max(100000).optional().nullable(),
  })).max(100).default([]),
});

export const instantiateProjectTemplateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  memberIds: z.array(z.string().uuid()).default([]),
});

export type CreateProjectTemplateInput = z.infer<typeof createProjectTemplateSchema>;
export type InstantiateProjectTemplateInput = z.infer<typeof instantiateProjectTemplateSchema>;
