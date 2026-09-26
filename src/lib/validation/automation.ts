import { z } from "zod";

export const automationTriggerValues = ["deal_won", "deal_stage_changed"] as const;
export const automationActionValues = ["create_project_from_deal", "create_crm_follow_up"] as const;

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(180),
  triggerType: z.enum(automationTriggerValues),
  actionType: z.enum(automationActionValues),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;

export const updateAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
