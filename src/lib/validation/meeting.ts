import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().trim().min(2, "عنوان جلسه را وارد کنید.").max(200),
  projectId: z.string().uuid().optional().nullable(),
  agenda: z.string().trim().max(4000).optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().trim().max(200).optional().nullable(),
  participantIds: z.array(z.string().uuid()).default([]),
});
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = createMeetingSchema.partial().extend({
  notes: z.string().trim().max(8000).optional().nullable(),
});

export const createActionItemSchema = z.object({
  title: z.string().trim().min(1).max(220),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  createTask: z.boolean().default(false),
});
