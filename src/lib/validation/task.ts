import { z } from "zod";
import { priorityValues } from "@/lib/validation/project";

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid().optional(),
  title: z.string().trim().min(1, "عنوان وظیفه را وارد کنید.").max(220),
  description: z.string().trim().max(8000).optional().nullable(),
  priority: z.enum(priorityValues).default("medium"),
  assigneeId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().min(0).max(100000).optional().nullable(),
  tagIds: z.array(z.string().uuid()).default([]),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(220).optional(),
  description: z.string().trim().max(8000).optional().nullable(),
  priority: z.enum(priorityValues).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  statusId: z.string().uuid().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  position: z.number().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  completed: z.boolean().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  statusId: z.string().uuid(),
  position: z.number(),
});

export const createDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
  type: z.enum(["blocks", "blocked_by"]).default("blocked_by"),
});

export const createChecklistItemSchema = z.object({
  title: z.string().trim().min(1).max(220),
});

export const updateChecklistItemSchema = z.object({
  title: z.string().trim().min(1).max(220).optional(),
  isDone: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "متن نظر را وارد کنید.").max(4000),
  parentCommentId: z.string().uuid().optional().nullable(),
});

export const createTimeEntrySchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional().nullable(),
  durationMinutes: z.number().int().min(0).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
});

export const createAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileUrl: z.string().trim().url("لینک معتبر نیست."),
  fileType: z.string().trim().max(80).optional(),
});


export const bulkTaskActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    assigneeId: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal("priority"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    priority: z.enum(priorityValues),
  }),
  z.object({
    action: z.literal("status"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    statusId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("complete"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
  }),
  z.object({
    action: z.literal("reopen"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
  }),
  z.object({
    action: z.literal("delete"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
  }),
]);

export type BulkTaskActionInput = z.infer<typeof bulkTaskActionSchema>;
