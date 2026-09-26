import "server-only";

import { db } from "@/db";
import {
  automationRules,
  automationRuns,
  crmActivities,
  crmDeals,
  crmLeads,
  notifications,
} from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  AutomationTrigger,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "@/lib/validation/automations";
import { NotFoundError } from "@/lib/api-response";
import { createProject } from "@/server/projects";

type EntityType = "crm_lead" | "crm_deal";

type AutomationContext = {
  workspaceId: string;
  actorId: string;
  trigger: AutomationTrigger;
  entityType: EntityType;
  entityId: string;
};

type EntitySnapshot = {
  id: string;
  title: string;
  ownerId: string | null;
  status: string;
  stageId?: string | null;
  projectId?: string | null;
  value?: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberConfig(config: Record<string, unknown>, key: string, fallback: number) {
  const value = Number(config[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stringConfig(config: Record<string, unknown>, key: string, fallback: string) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function getEntitySnapshot(context: AutomationContext): Promise<EntitySnapshot | null> {
  if (context.entityType === "crm_lead") {
    const rows = await db
      .select({
        id: crmLeads.id,
        name: crmLeads.name,
        ownerId: crmLeads.ownerId,
        status: crmLeads.status,
      })
      .from(crmLeads)
      .where(and(eq(crmLeads.id, context.entityId), eq(crmLeads.workspaceId, context.workspaceId)))
      .limit(1);

    const lead = rows[0];
    if (!lead) return null;
    return { id: lead.id, title: lead.name, ownerId: lead.ownerId, status: lead.status };
  }

  const rows = await db
    .select({
      id: crmDeals.id,
      title: crmDeals.title,
      ownerId: crmDeals.ownerId,
      status: crmDeals.status,
      stageId: crmDeals.stageId,
      projectId: crmDeals.projectId,
      value: crmDeals.value,
    })
    .from(crmDeals)
    .where(and(eq(crmDeals.id, context.entityId), eq(crmDeals.workspaceId, context.workspaceId)))
    .limit(1);

  const deal = rows[0];
  if (!deal) return null;
  return {
    id: deal.id,
    title: deal.title,
    ownerId: deal.ownerId,
    status: deal.status,
    stageId: deal.stageId,
    projectId: deal.projectId,
    value: deal.value,
  };
}

function conditionsMatch(conditionsValue: unknown, entity: EntitySnapshot) {
  const conditions = asRecord(conditionsValue);

  if (typeof conditions.status === "string" && conditions.status !== entity.status) return false;
  if (typeof conditions.stageId === "string" && conditions.stageId !== entity.stageId) return false;

  return true;
}

async function executeRule(
  rule: typeof automationRules.$inferSelect,
  context: AutomationContext,
  entity: EntitySnapshot,
) {
  const config = asRecord(rule.actionConfig);

  if (rule.action === "create_follow_up") {
    const dueInDays = Math.max(0, Math.min(365, numberConfig(config, "dueInDays", 1)));
    const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);

    await db.insert(crmActivities).values({
      workspaceId: context.workspaceId,
      leadId: context.entityType === "crm_lead" ? entity.id : null,
      dealId: context.entityType === "crm_deal" ? entity.id : null,
      type: "task",
      title: stringConfig(config, "title", `پیگیری خودکار: ${entity.title}`),
      note: stringConfig(config, "note", "این پیگیری توسط اتوماسیون سامورایی ساخته شده است."),
      dueAt,
      assignedTo: entity.ownerId,
      createdBy: context.actorId,
    });

    return "پیگیری خودکار ایجاد شد.";
  }

  if (rule.action === "notify_owner") {
    if (!entity.ownerId) return "بدون مسئول؛ اعلان ساخته نشد.";

    await db.insert(notifications).values({
      workspaceId: context.workspaceId,
      userId: entity.ownerId,
      type: "system",
      priority: "important",
      title: stringConfig(config, "title", "سامورایی: اقدام لازم است"),
      body: stringConfig(config, "body", `«${entity.title}» نیاز به بررسی دارد.`),
      link: context.entityType === "crm_deal" ? "/app/crm" : "/app/crm",
    });

    return "اعلان برای مسئول ایجاد شد.";
  }

  if (rule.action === "create_project") {
    if (context.entityType !== "crm_deal") return "این اقدام فقط برای فرصت فروش قابل اجراست.";
    if (entity.status !== "won") return "فروش هنوز برنده نشده است.";
    if (entity.projectId) return "برای این فروش قبلاً پروژه ساخته شده است.";

    const priorityRaw = stringConfig(config, "priority", "medium");
    const priority = ["critical", "high", "medium", "low"].includes(priorityRaw)
      ? (priorityRaw as "critical" | "high" | "medium" | "low")
      : "medium";

    const project = await createProject(context.workspaceId, context.actorId, {
      name: stringConfig(config, "name", entity.title),
      description: stringConfig(
        config,
        "description",
        `پروژه به‌صورت خودکار از فروش موفق «${entity.title}» ساخته شد.`,
      ),
      priority,
      color: stringConfig(config, "color", "#4f46e5"),
      startDate: new Date().toISOString(),
      dueDate: null,
      memberIds: entity.ownerId ? [entity.ownerId] : [],
    });

    await db
      .update(crmDeals)
      .set({ projectId: project.id, updatedAt: new Date() })
      .where(and(eq(crmDeals.id, entity.id), eq(crmDeals.workspaceId, context.workspaceId)));

    return `پروژه «${project.name}» ساخته شد.`;
  }

  return "اقدام شناخته نشد.";
}

export async function listAutomationRules(workspaceId: string) {
  return db
    .select()
    .from(automationRules)
    .where(eq(automationRules.workspaceId, workspaceId))
    .orderBy(desc(automationRules.createdAt));
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
      description: input.description || null,
      trigger: input.trigger,
      action: input.action,
      conditions: input.conditions,
      actionConfig: input.actionConfig,
      isActive: input.isActive,
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
  const rows = await db
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.id, ruleId), eq(automationRules.workspaceId, workspaceId)))
    .limit(1);

  if (!rows[0]) throw new NotFoundError("اتوماسیون یافت نشد.");

  const patch: Partial<typeof automationRules.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.conditions !== undefined) patch.conditions = input.conditions;
  if (input.actionConfig !== undefined) patch.actionConfig = input.actionConfig;

  const [rule] = await db
    .update(automationRules)
    .set(patch)
    .where(eq(automationRules.id, ruleId))
    .returning();

  return rule;
}

export async function runCrmAutomations(context: AutomationContext) {
  const [entity, rules] = await Promise.all([
    getEntitySnapshot(context),
    db
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.workspaceId, context.workspaceId),
          eq(automationRules.trigger, context.trigger),
          eq(automationRules.isActive, true),
        ),
      ),
  ]);

  if (!entity || rules.length === 0) return [];

  const results: { ruleId: string; status: "success" | "failed" | "skipped"; message: string }[] = [];

  for (const rule of rules) {
    if (!conditionsMatch(rule.conditions, entity)) {
      const message = "شرایط این اتوماسیون برقرار نبود.";
      await db.insert(automationRuns).values({
        workspaceId: context.workspaceId,
        ruleId: rule.id,
        entityType: context.entityType,
        entityId: entity.id,
        status: "skipped",
        message,
        payload: { trigger: context.trigger },
      });
      results.push({ ruleId: rule.id, status: "skipped", message });
      continue;
    }

    try {
      const message = await executeRule(rule, context, entity);

      await db.transaction(async (tx) => {
        await tx.insert(automationRuns).values({
          workspaceId: context.workspaceId,
          ruleId: rule.id,
          entityType: context.entityType,
          entityId: entity.id,
          status: "success",
          message,
          payload: { trigger: context.trigger },
        });

        await tx
          .update(automationRules)
          .set({
            runCount: sql`${automationRules.runCount} + 1`,
            lastRunAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(automationRules.id, rule.id));
      });

      results.push({ ruleId: rule.id, status: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "اجرای اتوماسیون ناموفق بود.";

      await db.insert(automationRuns).values({
        workspaceId: context.workspaceId,
        ruleId: rule.id,
        entityType: context.entityType,
        entityId: entity.id,
        status: "failed",
        message: message.slice(0, 500),
        payload: { trigger: context.trigger },
      });

      results.push({ ruleId: rule.id, status: "failed", message });
    }
  }

  return results;
}
