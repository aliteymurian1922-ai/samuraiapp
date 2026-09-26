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
import { instantiateProjectTemplate } from "@/server/project-templates";

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

type RuleConfig = {
  description?: string | null;
  conditions?: Record<string, unknown>;
  actionConfig?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getRuleConfig(value: unknown): RuleConfig {
  const root = asRecord(value);
  return {
    description: typeof root.description === "string" ? root.description : null,
    conditions: asRecord(root.conditions),
    actionConfig: asRecord(root.actionConfig),
  };
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

function conditionsMatch(conditions: Record<string, unknown>, entity: EntitySnapshot) {
  if (typeof conditions.status === "string" && conditions.status !== entity.status) return false;
  if (typeof conditions.stageId === "string" && conditions.stageId !== entity.stageId) return false;
  return true;
}

async function executeRule(
  rule: typeof automationRules.$inferSelect,
  context: AutomationContext,
  entity: EntitySnapshot,
) {
  const config = getRuleConfig(rule.config);
  const actionConfig = config.actionConfig ?? {};

  if (rule.actionType === "create_follow_up") {
    const dueInDays = Math.max(0, Math.min(365, numberConfig(actionConfig, "dueInDays", 1)));
    const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);

    await db.insert(crmActivities).values({
      workspaceId: context.workspaceId,
      leadId: context.entityType === "crm_lead" ? entity.id : null,
      dealId: context.entityType === "crm_deal" ? entity.id : null,
      type: "task",
      title: stringConfig(actionConfig, "title", `پیگیری خودکار: ${entity.title}`),
      note: stringConfig(actionConfig, "note", "این پیگیری توسط اتوماسیون سامورایی ساخته شده است."),
      dueAt,
      assignedTo: entity.ownerId,
      createdBy: context.actorId,
    });

    return { message: "پیگیری خودکار ایجاد شد." };
  }

  if (rule.actionType === "notify_owner") {
    if (!entity.ownerId) return { message: "بدون مسئول؛ اعلان ساخته نشد.", skipped: true };

    await db.insert(notifications).values({
      workspaceId: context.workspaceId,
      userId: entity.ownerId,
      type: "system",
      priority: "important",
      title: stringConfig(actionConfig, "title", "سامورایی: اقدام لازم است"),
      body: stringConfig(actionConfig, "body", `«${entity.title}» نیاز به بررسی دارد.`),
      link: "/app/crm",
    });

    return { message: "اعلان برای مسئول ایجاد شد." };
  }

  if (rule.actionType === "create_project") {
    if (context.entityType !== "crm_deal") {
      return { message: "ساخت پروژه فقط برای فرصت فروش قابل اجراست.", skipped: true };
    }
    if (entity.status !== "won") {
      return { message: "فروش هنوز برنده نشده است.", skipped: true };
    }
    if (entity.projectId) {
      return { message: "برای این فروش قبلاً پروژه ساخته شده است.", skipped: true };
    }

    const priorityRaw = stringConfig(actionConfig, "priority", "medium");
    const priority = ["critical", "high", "medium", "low"].includes(priorityRaw)
      ? (priorityRaw as "critical" | "high" | "medium" | "low")
      : "medium";

    const templateId =
      typeof actionConfig.templateId === "string" && actionConfig.templateId.trim()
        ? actionConfig.templateId.trim()
        : null;

    const project = templateId
      ? await instantiateProjectTemplate(context.workspaceId, context.actorId, templateId, {
          name: stringConfig(actionConfig, "name", entity.title),
          memberIds: entity.ownerId ? [entity.ownerId] : [],
        })
      : await createProject(context.workspaceId, context.actorId, {
          name: stringConfig(actionConfig, "name", entity.title),
          description: stringConfig(
            actionConfig,
            "description",
            `پروژه به‌صورت خودکار از فروش موفق «${entity.title}» ساخته شد.`,
          ),
          priority,
          color: stringConfig(actionConfig, "color", "#4f46e5"),
          startDate: new Date().toISOString(),
          dueDate: null,
          memberIds: entity.ownerId ? [entity.ownerId] : [],
        });

    await db
      .update(crmDeals)
      .set({ projectId: project.id, updatedAt: new Date() })
      .where(and(eq(crmDeals.id, entity.id), eq(crmDeals.workspaceId, context.workspaceId)));

    return { message: `پروژه «${project.name}» ساخته شد.`, projectId: project.id };
  }

  return { message: "اقدام شناخته نشد.", skipped: true };
}

export async function listAutomationRules(workspaceId: string) {
  const rows = await db
    .select({
      id: automationRules.id,
      workspaceId: automationRules.workspaceId,
      name: automationRules.name,
      triggerType: automationRules.triggerType,
      actionType: automationRules.actionType,
      config: automationRules.config,
      isActive: automationRules.isActive,
      createdBy: automationRules.createdBy,
      lastRunAt: automationRules.lastRunAt,
      createdAt: automationRules.createdAt,
      updatedAt: automationRules.updatedAt,
      runCount: sql<number>`(
        select count(*)::int
        from automation_runs ar
        where ar.rule_id = ${automationRules.id}
          and ar.status = 'success'
      )`,
    })
    .from(automationRules)
    .where(eq(automationRules.workspaceId, workspaceId))
    .orderBy(desc(automationRules.createdAt));

  return rows.map((row) => {
    const config = getRuleConfig(row.config);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      description: config.description ?? null,
      trigger: row.triggerType,
      action: row.actionType,
      conditions: config.conditions ?? {},
      actionConfig: config.actionConfig ?? {},
      isActive: row.isActive,
      createdBy: row.createdBy,
      runCount: row.runCount,
      lastRunAt: row.lastRunAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

export async function listAutomationRuns(workspaceId: string, limit = 30) {
  const rows = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.workspaceId, workspaceId))
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit);

  return rows.map((run) => {
    const result = asRecord(run.result);
    return {
      id: run.id,
      workspaceId: run.workspaceId,
      ruleId: run.ruleId,
      entityType: run.sourceEntityType,
      entityId: run.sourceEntityId,
      status: run.status,
      message:
        typeof result.message === "string"
          ? result.message
          : run.error || null,
      createdAt: run.createdAt,
    };
  });
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
      triggerType: input.trigger,
      actionType: input.action,
      config: {
        description: input.description || null,
        conditions: input.conditions,
        actionConfig: input.actionConfig,
      },
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

  const existing = rows[0];
  if (!existing) throw new NotFoundError("اتوماسیون یافت نشد.");

  const current = getRuleConfig(existing.config);
  const nextConfig = {
    description: input.description !== undefined ? input.description : current.description ?? null,
    conditions: input.conditions !== undefined ? input.conditions : current.conditions ?? {},
    actionConfig: input.actionConfig !== undefined ? input.actionConfig : current.actionConfig ?? {},
  };

  const patch: Partial<typeof automationRules.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (
    input.description !== undefined ||
    input.conditions !== undefined ||
    input.actionConfig !== undefined
  ) {
    patch.config = nextConfig;
  }

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
          eq(automationRules.triggerType, context.trigger),
          eq(automationRules.isActive, true),
        ),
      ),
  ]);

  if (!entity || rules.length === 0) return [];

  const results: { ruleId: string; status: "success" | "failed" | "skipped"; message: string }[] = [];

  for (const rule of rules) {
    const config = getRuleConfig(rule.config);
    if (!conditionsMatch(config.conditions ?? {}, entity)) {
      const message = "شرایط این اتوماسیون برقرار نبود.";

      await db.insert(automationRuns).values({
        workspaceId: context.workspaceId,
        ruleId: rule.id,
        status: "skipped",
        sourceEntityType: context.entityType,
        sourceEntityId: entity.id,
        result: { message, trigger: context.trigger },
      });

      results.push({ ruleId: rule.id, status: "skipped", message });
      continue;
    }

    try {
      const outcome = await executeRule(rule, context, entity);
      const status = outcome.skipped ? "skipped" : "success";

      await db.transaction(async (tx) => {
        await tx.insert(automationRuns).values({
          workspaceId: context.workspaceId,
          ruleId: rule.id,
          status,
          sourceEntityType: context.entityType,
          sourceEntityId: entity.id,
          result: { ...outcome, trigger: context.trigger },
        });

        await tx
          .update(automationRules)
          .set({ lastRunAt: new Date(), updatedAt: new Date() })
          .where(eq(automationRules.id, rule.id));
      });

      results.push({ ruleId: rule.id, status, message: outcome.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "اجرای اتوماسیون ناموفق بود.";

      await db.insert(automationRuns).values({
        workspaceId: context.workspaceId,
        ruleId: rule.id,
        status: "failed",
        sourceEntityType: context.entityType,
        sourceEntityId: entity.id,
        result: { trigger: context.trigger },
        error: message,
      });

      results.push({ ruleId: rule.id, status: "failed", message });
    }
  }

  return results;
}
