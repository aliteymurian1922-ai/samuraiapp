import "server-only";

import { db } from "@/db";
import {
  crmActivities,
  crmCompanies,
  crmContacts,
  crmDealProducts,
  crmDeals,
  crmPipelineStages,
  crmPipelines,
  crmProducts,
  projects,
  users,
} from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { NotFoundError } from "@/lib/api-response";
import { getCrmCustomFieldValues } from "@/server/crm-custom-fields";

export async function getDeal360(workspaceId: string, dealId: string) {
  const rows = await db
    .select({
      id: crmDeals.id,
      pipelineId: crmDeals.pipelineId,
      pipelineName: crmPipelines.name,
      stageId: crmDeals.stageId,
      stageName: crmPipelineStages.name,
      stageColor: crmPipelineStages.color,
      stageProbability: crmPipelineStages.probability,
      title: crmDeals.title,
      value: crmDeals.value,
      status: crmDeals.status,
      source: crmDeals.source,
      expectedCloseAt: crmDeals.expectedCloseAt,
      lostReason: crmDeals.lostReason,
      wonAt: crmDeals.wonAt,
      lostAt: crmDeals.lostAt,
      ownerId: crmDeals.ownerId,
      ownerName: users.name,
      companyId: crmDeals.companyId,
      companyName: crmCompanies.name,
      contactId: crmDeals.contactId,
      contactName: crmContacts.name,
      contactPhone: crmContacts.phone,
      contactEmail: crmContacts.email,
      projectId: crmDeals.projectId,
      projectName: projects.name,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
    })
    .from(crmDeals)
    .innerJoin(crmPipelines, eq(crmPipelines.id, crmDeals.pipelineId))
    .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
    .leftJoin(users, eq(users.id, crmDeals.ownerId))
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmDeals.companyId))
    .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
    .leftJoin(projects, eq(projects.id, crmDeals.projectId))
    .where(
      and(
        eq(crmDeals.workspaceId, workspaceId),
        eq(crmDeals.id, dealId),
      ),
    )
    .limit(1);

  const deal = rows[0];
  if (!deal) throw new NotFoundError("فرصت فروش یافت نشد.");

  const [stages, products, activities, customFields] = await Promise.all([
    db
      .select({
        id: crmPipelineStages.id,
        name: crmPipelineStages.name,
        color: crmPipelineStages.color,
        position: crmPipelineStages.position,
        probability: crmPipelineStages.probability,
        isWon: crmPipelineStages.isWon,
        isLost: crmPipelineStages.isLost,
      })
      .from(crmPipelineStages)
      .where(
        and(
          eq(crmPipelineStages.workspaceId, workspaceId),
          eq(crmPipelineStages.pipelineId, deal.pipelineId),
        ),
      )
      .orderBy(asc(crmPipelineStages.position)),
    db
      .select({
        productId: crmDealProducts.productId,
        name: crmProducts.name,
        sku: crmProducts.sku,
        quantity: crmDealProducts.quantity,
        unitPrice: crmDealProducts.unitPrice,
      })
      .from(crmDealProducts)
      .innerJoin(crmProducts, eq(crmProducts.id, crmDealProducts.productId))
      .where(eq(crmDealProducts.dealId, deal.id)),
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
        createdAt: crmActivities.createdAt,
      })
      .from(crmActivities)
      .leftJoin(users, eq(users.id, crmActivities.assignedTo))
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          eq(crmActivities.dealId, deal.id),
        ),
      )
      .orderBy(
        asc(crmActivities.completedAt),
        asc(crmActivities.dueAt),
        desc(crmActivities.createdAt),
      ),
    getCrmCustomFieldValues(workspaceId, "deal", deal.id),
  ]);

  const openActivities = activities.filter((item) => !item.completedAt);
  const nextFollowUp = openActivities
    .filter((item) => item.dueAt)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0] ?? null;

  return {
    deal,
    stages,
    products: products.map((item) => ({
      ...item,
      lineTotal: Number(item.unitPrice) * item.quantity,
    })),
    activities,
    customFields,
    metrics: {
      weightedValue: Math.round(Number(deal.value) * Number(deal.stageProbability) / 100),
      openFollowUps: openActivities.length,
      nextFollowUpAt: nextFollowUp?.dueAt ?? null,
      productValue: products.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      ),
    },
  };
}
