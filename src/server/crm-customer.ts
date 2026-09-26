import "server-only";

import { db } from "@/db";
import {
  crmActivities,
  crmCompanies,
  crmContacts,
  crmDeals,
  crmPipelineStages,
  projects,
  users,
} from "@/db/schema";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { NotFoundError } from "@/lib/api-response";
import type { UpdateCustomerInput } from "@/lib/validation/crm";
import { getCrmCustomFieldValues } from "@/server/crm-custom-fields";

export async function getCustomer360(workspaceId: string, customerId: string) {
  const customerRows = await db
    .select({
      id: crmContacts.id,
      name: crmContacts.name,
      jobTitle: crmContacts.jobTitle,
      phone: crmContacts.phone,
      email: crmContacts.email,
      source: crmContacts.source,
      notes: crmContacts.notes,
      companyId: crmContacts.companyId,
      companyName: crmCompanies.name,
      companyIndustry: crmCompanies.industry,
      companyWebsite: crmCompanies.website,
      ownerId: crmContacts.ownerId,
      ownerName: users.name,
      createdAt: crmContacts.createdAt,
      updatedAt: crmContacts.updatedAt,
    })
    .from(crmContacts)
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmContacts.companyId))
    .leftJoin(users, eq(users.id, crmContacts.ownerId))
    .where(
      and(
        eq(crmContacts.workspaceId, workspaceId),
        eq(crmContacts.id, customerId),
      ),
    )
    .limit(1);

  const customer = customerRows[0];
  if (!customer) throw new NotFoundError("مشتری یافت نشد.");

  const dealCondition = customer.companyId
    ? or(
        eq(crmDeals.contactId, customer.id),
        eq(crmDeals.companyId, customer.companyId),
      )
    : eq(crmDeals.contactId, customer.id);

  const activityCondition = customer.companyId
    ? or(
        eq(crmActivities.contactId, customer.id),
        eq(crmActivities.companyId, customer.companyId),
      )
    : eq(crmActivities.contactId, customer.id);

  const [deals, activities, customFields] = await Promise.all([
    db
      .select({
        id: crmDeals.id,
        title: crmDeals.title,
        value: crmDeals.value,
        status: crmDeals.status,
        stageId: crmDeals.stageId,
        stageName: crmPipelineStages.name,
        stageColor: crmPipelineStages.color,
        expectedCloseAt: crmDeals.expectedCloseAt,
        lostReason: crmDeals.lostReason,
        projectId: crmDeals.projectId,
        projectName: projects.name,
        ownerId: crmDeals.ownerId,
        ownerName: users.name,
        createdAt: crmDeals.createdAt,
      })
      .from(crmDeals)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
      .leftJoin(users, eq(users.id, crmDeals.ownerId))
      .leftJoin(projects, eq(projects.id, crmDeals.projectId))
      .where(and(eq(crmDeals.workspaceId, workspaceId), dealCondition))
      .orderBy(desc(crmDeals.createdAt)),
    db
      .select({
        id: crmActivities.id,
        type: crmActivities.type,
        title: crmActivities.title,
        note: crmActivities.note,
        dueAt: crmActivities.dueAt,
        completedAt: crmActivities.completedAt,
        assignedTo: crmActivities.assignedTo,
        assigneeName: users.name,
        dealId: crmActivities.dealId,
        contactId: crmActivities.contactId,
        companyId: crmActivities.companyId,
        createdAt: crmActivities.createdAt,
      })
      .from(crmActivities)
      .leftJoin(users, eq(users.id, crmActivities.assignedTo))
      .where(and(eq(crmActivities.workspaceId, workspaceId), activityCondition))
      .orderBy(
        asc(crmActivities.completedAt),
        asc(crmActivities.dueAt),
        desc(crmActivities.createdAt),
      ),
    getCrmCustomFieldValues(workspaceId, "contact", customer.id),
  ]);

  const wonDeals = deals.filter((deal) => deal.status === "won");
  const openDeals = deals.filter((deal) => deal.status === "open");
  const openActivities = activities.filter((activity) => !activity.completedAt);
  const nextFollowUp = openActivities
    .filter((activity) => activity.dueAt)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0] ?? null;

  return {
    customer,
    customFields,
    deals,
    activities,
    metrics: {
      deals: deals.length,
      openDeals: openDeals.length,
      wonDeals: wonDeals.length,
      totalWonValue: wonDeals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0),
      openPipelineValue: openDeals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0),
      openFollowUps: openActivities.length,
      nextFollowUpAt: nextFollowUp?.dueAt ?? null,
    },
  };
}

export async function updateCustomerProfile(
  workspaceId: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const rows = await db
    .select({ id: crmContacts.id })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.id, customerId),
        eq(crmContacts.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!rows[0]) throw new NotFoundError("مشتری یافت نشد.");

  const patch: Partial<typeof crmContacts.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.jobTitle !== undefined) patch.jobTitle = input.jobTitle || null;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.email !== undefined) patch.email = input.email || null;
  if (input.source !== undefined) patch.source = input.source || null;
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
  if (input.notes !== undefined) patch.notes = input.notes || null;

  const [updated] = await db
    .update(crmContacts)
    .set(patch)
    .where(eq(crmContacts.id, customerId))
    .returning();

  return updated;
}
