import "server-only";

import { db } from "@/db";
import {
  crmActivities,
  crmContacts,
  crmDeals,
  crmLeads,
  users,
} from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { NotFoundError } from "@/lib/api-response";
import { getCrmCustomFieldValues } from "@/server/crm-custom-fields";
import { calculateLeadScore } from "@/lib/crm/lead-scoring";
import { sql } from "drizzle-orm";
import { summarizeLeadActivities } from "@/lib/crm/lead-activity-summary";

export async function getLead360(workspaceId: string, leadId: string) {
  const leadRows = await db
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
      updatedAt: crmLeads.updatedAt,
    })
    .from(crmLeads)
    .leftJoin(users, eq(users.id, crmLeads.ownerId))
    .where(
      and(
        eq(crmLeads.id, leadId),
        eq(crmLeads.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  const lead = leadRows[0];
  if (!lead) throw new NotFoundError("سرنخ یافت نشد.");

  const [activities, customFields, maxValueRows] = await Promise.all([
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
        dealTitle: crmDeals.title,
        contactId: crmActivities.contactId,
        contactName: crmContacts.name,
        companyId: crmActivities.companyId,
        createdAt: crmActivities.createdAt,
      })
      .from(crmActivities)
      .leftJoin(users, eq(users.id, crmActivities.assignedTo))
      .leftJoin(crmDeals, eq(crmDeals.id, crmActivities.dealId))
      .leftJoin(crmContacts, eq(crmContacts.id, crmActivities.contactId))
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.leadId, lead.id),
        ),
      )
      .orderBy(
        asc(crmActivities.completedAt),
        asc(crmActivities.dueAt),
        desc(crmActivities.createdAt),
      ),
    getCrmCustomFieldValues(workspaceId, "lead", lead.id),
    db
      .select({
        maxEstimatedValue: sql<number>`coalesce(max(${crmLeads.estimatedValue}), 0)::bigint`,
      })
      .from(crmLeads)
      .where(eq(crmLeads.workspaceId, workspaceId)),
  ]);

  const now = new Date();
  const activitySummary = summarizeLeadActivities(activities, now);

  const conversionActivity = activities.find(
    (activity) => Boolean(activity.dealId || activity.contactId),
  );

  const score = calculateLeadScore({
    status: lead.status,
    estimatedValue: lead.estimatedValue,
    maxEstimatedValue: Number(maxValueRows[0]?.maxEstimatedValue ?? 0),
    phone: lead.phone,
    email: lead.email,
    companyName: lead.companyName,
    source: lead.source,
    ownerId: lead.ownerId,
    notes: lead.notes,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    ...activitySummary,
    now,
  });

  return {
    lead,
    score,
    customFields,
    activities,
    conversion: conversionActivity
      ? {
          dealId: conversionActivity.dealId,
          dealTitle: conversionActivity.dealTitle,
          contactId: conversionActivity.contactId,
          contactName: conversionActivity.contactName,
        }
      : null,
    metrics: {
      openFollowUps: activitySummary.openFollowUps,
      completedActivities: activitySummary.completedActivities,
      nextFollowUpAt: activitySummary.nextFollowUpAt,
      lastInteractionAt: activitySummary.lastActivityAt ?? lead.updatedAt,
    },
  };
}
