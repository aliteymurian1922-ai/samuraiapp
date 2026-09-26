import { z } from "zod";

export const recurrenceFrequencyValues = ["daily", "weekly", "monthly"] as const;

export const taskRecurrenceSchema = z.object({
  frequency: z.enum(recurrenceFrequencyValues),
  interval: z.number().int().min(1).max(365).default(1),
  endAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type TaskRecurrenceInput = z.infer<typeof taskRecurrenceSchema>;
export type RecurrenceFrequency = (typeof recurrenceFrequencyValues)[number];
