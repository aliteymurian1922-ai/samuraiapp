import "server-only";
import { db } from "@/db";
import {
  automationRules,
  automationRuns,
  crmActivities,
  crmDeals,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "@/lib/validation/automation";
import { applyProjectTemplate } from "@/server/project-templates";
import { convertDealToProject, createCrmActivity } from "@/server/crm";

export type AutomationTrigger = "deal_won" | "deal_stage_changed";

export async function listAutomationRules(workspaceId: string) {
  return db
    .select()
    .from(automationRules)
    .where(eq(automationRules.workspaceId, workspaceId))
    .orderBy(desc(automationRules.updatedAt));
}

export async function listAutomationRuns(workspaceId: string, limit = 30) {
  return db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.workspaceId, workspaceId))
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit);
}

export async function createAutomationRule(
  workspaceId: string,
  userId: string,
  input: CreateAutomationRuleInput,
) {
  const [rule] = await db
    .insert(automationRules)
    .values({
      workspaceId,
      name: input.name,
      triggerType: input.triggerType,
      actionType: input.actionType,
      config: input.config,
      createdBy: userId,
    })
    .returning();

  return rule;
}

export async function updateAutomationRule(
  workspaceId: string,
  ruleId: string,
  input: UpdateAutomationRuleInput,
) {
  const patch: Partial<typeof automationRules.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.config !== undefined) patch.config = input.config;

  const [rule] = await db
    .update(automationRules)
    .set(patch)
    .where(and(eq(automationRules.id, ruleId), eq(automationRules.workspaceId, workspaceId)))
    .returning();

  return rule ?? null;
}

function addDays(base: Date, days: number) {
  const value = new Date(base);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

async function executeRule(input: {
  workspaceId: string;
  userId: string;
  rule: typeof automationRules.$inferSelect;
  entityId: string;
  payload: Record<string, unknown>;
}) {
  const { workspaceId, userId, rule, entityId, payload } = input;
  const config = rule.config ?? {};

  if (rule.triggerType === "deal_stage_changed") {
    const requiredStageId = typeof config.stageId === "string" ? config.stageId : null;
    if (requiredStageId && payload.stageId !== requiredStageId) {
      return { skipped: true, reason: "stage_mismatch" };
    }
  }

  if (rule.actionType === "create_project_from_deal") {
    const [deal] = await db
      .select({
        id: crmDeals.id,
        title: crmDeals.title,
        status: crmDeals.status,
        ownerId: crmDeals.ownerId,
        projectId: crmDeals.projectId,
      })
      .from(crmDeals)
      .where(and(eq(crmDeals.id, entityId), eq(crmDeals.workspaceId, workspaceId)))
      .limit(1);

    if (!deal || deal.status !== "won") {
      return { skipped: true, reason: "deal_not_won" };
    }
    if (deal.projectId) {
      return { skipped: true, reason: "project_exists", projectId: deal.projectId };
    }

    const templateId = typeof config.templateId === "string" ? config.templateId : null;

    if (templateId) {
      const project = await applyProjectTemplate(workspaceId, userId, templateId, {
        name: deal.title,
        memberIds: deal.ownerId ? [deal.ownerId] : [],
      });

      await db
        .update(crmDeals)
        .set({ projectId: project.id, updatedAt: new Date() })
        .where(and(eq(crmDeals.id, deal.id), eq(crmDeals.workspaceId, workspaceId)));

      await db.insert(crmActivities).values({
        workspaceId,
        dealId: deal.id,
        type: "note",
        title: "ساخت خودکار پروژه",
        note: `سامورایی پروژه «${project.name}» را به‌صورت خودکار از فروش موفق ساخت.`,
        createdBy: userId,
        completedAt: new Date(),
      });

      return { projectId: project.id, templateId };
    }

    const project = await convertDealToProject(workspaceId, userId, entityId, {
      priority: "medium",
      color: "#4f46e5",
      memberIds: [],
    });
    return { projectId: project.id };
  }

  if (rule.actionType === "create_crm_follow_up") {
    const [deal] = await db
      .select({ id: crmDeals.id, ownerId: crmDeals.ownerId, title: crmDeals.title })
      .from(crmDeals)
      .where(and(eq(crmDeals.id, entityId), eq(crmDeals.workspaceId, workspaceId)))
      .limit(1);

    if (!deal) return { skipped: true, reason: "deal_not_found" };

    const delayDays =
      typeof config.delayDays === "number" && Number.isFinite(config.delayDays)
        ? Math.max(0, Math.min(365, Math.round(config.delayDays)))
        : 1;
    const title =
      typeof config.title === "string" && config.title.trim()
        ? config.title.trim()
        : `پیگیری فرصت فروش «${deal.title}»`;
    const type =
      typeof config.activityType === "string" &&
      ["call", "message", "email", "meeting", "note", "task"].includes(config.activityType)
        ? (config.activityType as "call" | "message" | "email" | "meeting" | "note" | "task")
        : "task";

    const activity = await createCrmActivity(workspaceId, userId, {
      type,
      title,
      dueAt: addDays(new Date(), delayDays).toISOString(),
      assignedTo: deal.ownerId ?? userId,
      dealId: deal.id,
    });

    return { activityId: activity.id, dueAt: activity.dueAt };
  }

  return { skipped: true, reason: "unsupported_action" };
}

export async function runAutomationEvent(input: {
  workspaceId: string;
  userId: string;
  triggerType: AutomationTrigger;
  entityType: "crm_deal";
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  const rules = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.workspaceId, input.workspaceId),
        eq(automationRules.triggerType, input.triggerType),
        eq(automationRules.isActive, true),
      ),
    );

  const results = [];

  for (const rule of rules) {
    try {
      const result = await executeRule({
        workspaceId: input.workspaceId,
        userId: input.userId,
        rule,
        entityId: input.entityId,
        payload: input.payload ?? {},
      });

      const skipped = "skipped" in result && result.skipped === true;
      await db.insert(automationRuns).values({
        workspaceId: input.workspaceId,
        ruleId: rule.id,
        status: skipped ? "skipped" : "success",
        sourceEntityType: input.entityType,
        sourceEntityId: input.entityId,
        result,
      });

      if (!skipped) {
        await db
          .update(automationRules)
          .set({ lastRunAt: new Date(), updatedAt: new Date() })
          .where(eq(automationRules.id, rule.id));
      }

      results.push({ ruleId: rule.id, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.insert(automationRuns).values({
        workspaceId: input.workspaceId,
        ruleId: rule.id,
        status: "failed",
        sourceEntityType: input.entityType,
        sourceEntityId: input.entityId,
        error: message.slice(0, 4000),
      });
      results.push({ ruleId: rule.id, failed: true, error: message });
    }
  }

  return results;
}
