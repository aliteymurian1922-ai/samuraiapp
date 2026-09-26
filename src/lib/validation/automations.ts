import { z } from "zod";

export const automationTriggerValues = [
  "lead_created",
  "lead_status_changed",
  "deal_created",
  "deal_stage_changed",
  "deal_won",
  "deal_lost",
] as const;

export const automationActionValues = [
  "create_follow_up",
  "create_project",
  "notify_owner",
] as const;

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(2, "نام اتوماسیون را وارد کنید.").max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  trigger: z.enum(automationTriggerValues),
  action: z.enum(automationActionValues),
  conditions: z.record(z.string(), z.unknown()).default({}),
  actionConfig: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

export const updateAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  actionConfig: z.record(z.string(), z.unknown()).optional(),
});

export type AutomationTrigger = (typeof automationTriggerValues)[number];
export type AutomationAction = (typeof automationActionValues)[number];
export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
