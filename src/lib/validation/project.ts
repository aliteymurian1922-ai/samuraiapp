import { z } from "zod";

export const projectStatusValues = ["active", "on_hold", "completed", "archived"] as const;
export const priorityValues = ["critical", "high", "medium", "low"] as const;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "نام پروژه را وارد کنید.").max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(priorityValues).default("medium"),
  color: z.string().trim().max(20).default("#4f46e5"),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string().uuid()).default([]),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z.enum(projectStatusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  color: z.string().trim().max(20).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
