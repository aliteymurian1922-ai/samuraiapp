import "server-only";
import { db } from "@/db";
import {
  crmActivities,
  crmCompanies,
  crmContacts,
  crmDeals,
  crmLeads,
  crmPipelines,
  crmPipelineStages,
  users,
} from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  CreateCustomerInput,
  CreateDealInput,
  CreateLeadInput,
  UpdateDealInput,
  UpdateLeadInput,
} from "@/lib/validation/crm";
import { NotFoundError } from "@/lib/api-response";

const DEFAULT_STAGES = [
  { name: "سرنخ جدید", color: "#94a3b8", probability: 10, position: 0 },
  { name: "ارتباط برقرار شد", color: "#3b82f6", probability: 25, position: 1 },
  { name: "نیازسنجی / جلسه", color: "#06b6d4", probability: 45, position: 2 },
  { name: "پیشنهاد ارسال شد", color: "#f59e0b", probability: 65, position: 3 },
  { name: "مذاکره", color: "#8b5cf6", probability: 80, position: 4 },
  { name: "برنده", color: "#22c55e", probability: 100, position: 5, isWon: true },
  { name: "از دست رفته", color: "#ef4444", probability: 0, position: 6, isLost: true },
] as const;

export async function ensureDefaultPipeline(workspaceId: string) {
  const existing = await db
    .select()
    .from(crmPipelines)
    .where(and(eq(crmPipelines.workspaceId, workspaceId), eq(crmPipelines.isDefault, true)))
    .limit(1);

  if (existing[0]) return existing[0];

  const anyPipeline = await db
    .select()
    .from(crmPipelines)
    .where(eq(crmPipelines.workspaceId, workspaceId))
    .limit(1);

  if (anyPipeline[0]) return anyPipeline[0];

  const [pipeline] = await db
    .insert(crmPipelines)
    .values({ workspaceId, name: "فروش اصلی", isDefault: true })
    .returning();

  await db.insert(crmPipelineStages).values(
    DEFAULT_STAGES.map((stage) => ({
      workspaceId,
      pipelineId: pipeline.id,
      name: stage.name,
      color: stage.color,
      probability: stage.probability,
      position: stage.position,
      isWon: "isWon" in stage ? stage.isWon : false,
      isLost: "isLost" in stage ? stage.isLost : false,
    })),
  );

  return pipeline;
}

export async function getPipelineStages(workspaceId: string, pipelineId: string) {
  return db
    .select()
    .from(crmPipelineStages)
    .where(and(eq(crmPipelineStages.workspaceId, workspaceId), eq(crmPipelineStages.pipelineId, pipelineId)))
    .orderBy(crmPipelineStages.position);
}

export async function listDeals(workspaceId: string, pipelineId?: string) {
  const conditions = [eq(crmDeals.workspaceId, workspaceId)];
  if (pipelineId) conditions.push(eq(crmDeals.pipelineId, pipelineId));

  return db
    .select({
      id: crmDeals.id,
      pipelineId: crmDeals.pipelineId,
      stageId: crmDeals.stageId,
      companyId: crmDeals.companyId,
      contactId: crmDeals.contactId,
      title: crmDeals.title,
      value: crmDeals.value,
      status: crmDeals.status,
      ownerId: crmDeals.ownerId,
      source: crmDeals.source,
      expectedCloseAt: crmDeals.expectedCloseAt,
      lostReason: crmDeals.lostReason,
      createdAt: crmDeals.createdAt,
      companyName: crmCompanies.name,
      contactName: crmContacts.name,
      ownerName: users.name,
    })
    .from(crmDeals)
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmDeals.companyId))
    .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
    .leftJoin(users, eq(users.id, crmDeals.ownerId))
    .where(and(...conditions))
    .orderBy(desc(crmDeals.createdAt));
}

export async function getCrmOverview(workspaceId: string) {
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const [stages, deals, leadStats, customerStats] = await Promise.all([
    getPipelineStages(workspaceId, pipeline.id),
    listDeals(workspaceId, pipeline.id),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${crmLeads.status} not in ('converted', 'unqualified'))::int`,
      })
      .from(crmLeads)
      .where(eq(crmLeads.workspaceId, workspaceId)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmContacts)
      .where(eq(crmContacts.workspaceId, workspaceId)),
  ]);

  const openDeals = deals.filter((deal) => deal.status === "open");
  const wonDeals = deals.filter((deal) => deal.status === "won");
  const lostDeals = deals.filter((deal) => deal.status === "lost");
  const closed = wonDeals.length + lostDeals.length;

  return {
    pipeline,
    stages: stages.map((stage) => ({
      ...stage,
      deals: deals.filter((deal) => deal.stageId === stage.id),
    })),
    metrics: {
      customers: customerStats[0]?.total ?? 0,
      leads: leadStats[0]?.total ?? 0,
      activeLeads: leadStats[0]?.active ?? 0,
      openDeals: openDeals.length,
      openValue: openDeals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0),
      wonDeals: wonDeals.length,
      conversionRate: closed > 0 ? Math.round((wonDeals.length / closed) * 100) : 0,
    },
  };
}

export async function listLeads(workspaceId: string) {
  return db
    .select({
      id: crmLeads.id,
      name: crmLeads.name,
      companyName: crmLeads.companyName,
      phone: crmLeads.phone,
      email: crmLeads.email,
      source: crmLeads.source,
      status: crmLeads.status,
      estimatedValue: crmLeads.estimatedValue,
      ownerId: crmLeads.ownerId,
      ownerName: users.name,
      notes: crmLeads.notes,
      convertedAt: crmLeads.convertedAt,
      createdAt: crmLeads.createdAt,
    })
    .from(crmLeads)
    .leftJoin(users, eq(users.id, crmLeads.ownerId))
    .where(eq(crmLeads.workspaceId, workspaceId))
    .orderBy(desc(crmLeads.createdAt));
}

export async function createLead(workspaceId: string, userId: string, input: CreateLeadInput) {
  const [lead] = await db
    .insert(crmLeads)
    .values({
      workspaceId,
      name: input.name,
      companyName: input.companyName || null,
      phone: input.phone || null,
      email: input.email || null,
      source: input.source || null,
      estimatedValue: input.estimatedValue ?? null,
      ownerId: input.ownerId ?? userId,
      notes: input.notes || null,
    })
    .returning();

  return lead;
}

export async function updateLead(workspaceId: string, leadId: string, input: UpdateLeadInput) {
  const existing = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)))
    .limit(1);
  if (!existing[0]) throw new NotFoundError("سرنخ یافت نشد.");

  const patch: Partial<typeof crmLeads.$inferInsert> = { updatedAt: new Date() };
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "converted") patch.convertedAt = new Date();
  }
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
  if (input.notes !== undefined) patch.notes = input.notes;

  const [lead] = await db.update(crmLeads).set(patch).where(eq(crmLeads.id, leadId)).returning();
  return lead;
}

export async function listCustomers(workspaceId: string) {
  return db
    .select({
      id: crmContacts.id,
      name: crmContacts.name,
      jobTitle: crmContacts.jobTitle,
      phone: crmContacts.phone,
      email: crmContacts.email,
      source: crmContacts.source,
      companyId: crmContacts.companyId,
      companyName: crmCompanies.name,
      ownerId: crmContacts.ownerId,
      ownerName: users.name,
      notes: crmContacts.notes,
      createdAt: crmContacts.createdAt,
    })
    .from(crmContacts)
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmContacts.companyId))
    .leftJoin(users, eq(users.id, crmContacts.ownerId))
    .where(eq(crmContacts.workspaceId, workspaceId))
    .orderBy(desc(crmContacts.createdAt));
}

async function findCompanyByName(workspaceId: string, name: string) {
  const rows = await db
    .select()
    .from(crmCompanies)
    .where(and(eq(crmCompanies.workspaceId, workspaceId), eq(crmCompanies.name, name)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCustomer(workspaceId: string, userId: string, input: CreateCustomerInput) {
  let companyId: string | null = null;

  if (input.companyName) {
    const existing = await findCompanyByName(workspaceId, input.companyName);
    if (existing) {
      companyId = existing.id;
    } else {
      const [company] = await db
        .insert(crmCompanies)
        .values({
          workspaceId,
          name: input.companyName,
          phone: input.phone || null,
          email: input.email || null,
          ownerId: input.ownerId ?? userId,
        })
        .returning();
      companyId = company.id;
    }
  }

  const [contact] = await db
    .insert(crmContacts)
    .values({
      workspaceId,
      companyId,
      name: input.name,
      jobTitle: input.jobTitle || null,
      phone: input.phone || null,
      email: input.email || null,
      source: input.source || null,
      ownerId: input.ownerId ?? userId,
      notes: input.notes || null,
    })
    .returning();

  return contact;
}

async function getStageForDeal(workspaceId: string, pipelineId: string, stageId?: string | null) {
  if (stageId) {
    const rows = await db
      .select()
      .from(crmPipelineStages)
      .where(
        and(
          eq(crmPipelineStages.id, stageId),
          eq(crmPipelineStages.workspaceId, workspaceId),
          eq(crmPipelineStages.pipelineId, pipelineId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundError("مرحله فروش یافت نشد.");
    return rows[0];
  }

  const rows = await db
    .select()
    .from(crmPipelineStages)
    .where(and(eq(crmPipelineStages.workspaceId, workspaceId), eq(crmPipelineStages.pipelineId, pipelineId)))
    .orderBy(crmPipelineStages.position)
    .limit(1);

  if (!rows[0]) throw new NotFoundError("مرحله فروش یافت نشد.");
  return rows[0];
}

export async function createDeal(workspaceId: string, userId: string, input: CreateDealInput) {
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const stage = await getStageForDeal(workspaceId, pipeline.id, input.stageId);
  const status = stage.isWon ? "won" : stage.isLost ? "lost" : "open";

  const [deal] = await db
    .insert(crmDeals)
    .values({
      workspaceId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      companyId: input.companyId ?? null,
      contactId: input.contactId ?? null,
      title: input.title,
      value: input.value,
      status,
      ownerId: input.ownerId ?? userId,
      source: input.source || null,
      expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null,
      wonAt: status === "won" ? new Date() : null,
      lostAt: status === "lost" ? new Date() : null,
      createdBy: userId,
    })
    .returning();

  return deal;
}

export async function updateDeal(workspaceId: string, dealId: string, input: UpdateDealInput) {
  const rows = await db
    .select()
    .from(crmDeals)
    .where(and(eq(crmDeals.id, dealId), eq(crmDeals.workspaceId, workspaceId)))
    .limit(1);
  const existing = rows[0];
  if (!existing) throw new NotFoundError("فرصت فروش یافت نشد.");

  const patch: Partial<typeof crmDeals.$inferInsert> = { updatedAt: new Date() };

  if (input.stageId) {
    const stage = await getStageForDeal(workspaceId, existing.pipelineId, input.stageId);
    patch.stageId = stage.id;
    patch.status = stage.isWon ? "won" : stage.isLost ? "lost" : "open";
    patch.wonAt = stage.isWon ? new Date() : null;
    patch.lostAt = stage.isLost ? new Date() : null;
  }
  if (input.title !== undefined) patch.title = input.title;
  if (input.value !== undefined) patch.value = input.value;
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
  if (input.expectedCloseAt !== undefined) patch.expectedCloseAt = input.expectedCloseAt ? new Date(input.expectedCloseAt) : null;
  if (input.lostReason !== undefined) patch.lostReason = input.lostReason;

  const [deal] = await db.update(crmDeals).set(patch).where(eq(crmDeals.id, dealId)).returning();
  return deal;
}

export async function convertLeadToDeal(workspaceId: string, userId: string, leadId: string) {
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const stage = await getStageForDeal(workspaceId, pipeline.id);

  return db.transaction(async (tx) => {
    const leads = await tx
      .select()
      .from(crmLeads)
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)))
      .limit(1);
    const lead = leads[0];
    if (!lead) throw new NotFoundError("سرنخ یافت نشد.");
    if (lead.status === "converted") throw new Error("این سرنخ قبلاً تبدیل شده است.");

    let companyId: string | null = null;
    if (lead.companyName) {
      const companies = await tx
        .select()
        .from(crmCompanies)
        .where(and(eq(crmCompanies.workspaceId, workspaceId), eq(crmCompanies.name, lead.companyName)))
        .limit(1);
      if (companies[0]) {
        companyId = companies[0].id;
      } else {
        const [company] = await tx
          .insert(crmCompanies)
          .values({
            workspaceId,
            name: lead.companyName,
            phone: lead.phone,
            email: lead.email,
            ownerId: lead.ownerId ?? userId,
          })
          .returning();
        companyId = company.id;
      }
    }

    const [contact] = await tx
      .insert(crmContacts)
      .values({
        workspaceId,
        companyId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        ownerId: lead.ownerId ?? userId,
        notes: lead.notes,
      })
      .returning();

    const [deal] = await tx
      .insert(crmDeals)
      .values({
        workspaceId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        companyId,
        contactId: contact.id,
        title: `فرصت فروش ${lead.companyName || lead.name}`,
        value: lead.estimatedValue ?? 0,
        status: "open",
        ownerId: lead.ownerId ?? userId,
        source: lead.source,
        createdBy: userId,
      })
      .returning();

    await tx
      .update(crmLeads)
      .set({ status: "converted", convertedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmLeads.id, lead.id));

    await tx.insert(crmActivities).values({
      workspaceId,
      leadId: lead.id,
      dealId: deal.id,
      contactId: contact.id,
      companyId,
      type: "note",
      title: "تبدیل سرنخ به فرصت فروش",
      note: "این سرنخ به مشتری و فرصت فروش تبدیل شد.",
      createdBy: userId,
      completedAt: new Date(),
    });

    return { deal, contact, companyId };
  });
}
