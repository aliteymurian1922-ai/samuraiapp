import "server-only";

import { db } from "@/db";
import {
  crmActivities,
  crmDeals,
  crmLeads,
  crmPipelineStages,
  users,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { buildSalesForecast, scoreLead } from "@/lib/crm-intelligence";

export async function getCrmIntelligence(workspaceId: string) {
  const [leads, leadActivityStats, openDeals] = await Promise.all([
    db
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
        createdAt: crmLeads.createdAt,
      })
      .from(crmLeads)
      .leftJoin(users, eq(users.id, crmLeads.ownerId))
      .where(eq(crmLeads.workspaceId, workspaceId)),

    db
      .select({
        leadId: crmActivities.leadId,
        completedActivities: sql<number>`count(*) filter (where ${crmActivities.completedAt} is not null)::int`,
        openActivities: sql<number>`count(*) filter (where ${crmActivities.completedAt} is null)::int`,
        overdueActivities: sql<number>`count(*) filter (
          where ${crmActivities.completedAt} is null
          and ${crmActivities.dueAt} is not null
          and ${crmActivities.dueAt} < now()
        )::int`,
        lastInteractionAt: sql<Date | null>`max(${crmActivities.createdAt})`,
        nextFollowUpAt: sql<Date | null>`min(${crmActivities.dueAt}) filter (
          where ${crmActivities.completedAt} is null
          and ${crmActivities.dueAt} is not null
        )`,
      })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.workspaceId, workspaceId),
          sql`${crmActivities.leadId} is not null`,
        ),
      )
      .groupBy(crmActivities.leadId),

    db
      .select({
        id: crmDeals.id,
        value: crmDeals.value,
        expectedCloseAt: crmDeals.expectedCloseAt,
        ownerId: crmDeals.ownerId,
        ownerName: users.name,
        probability: crmPipelineStages.probability,
      })
      .from(crmDeals)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
      .leftJoin(users, eq(users.id, crmDeals.ownerId))
      .where(
        and(
          eq(crmDeals.workspaceId, workspaceId),
          eq(crmDeals.status, "open"),
        ),
      ),
  ]);

  const activityMap = new Map(
    leadActivityStats
      .filter((item) => item.leadId)
      .map((item) => [item.leadId!, item]),
  );

  const scores = leads.map((lead) => {
    const activity = activityMap.get(lead.id);

    return {
      leadId: lead.id,
      name: lead.name,
      companyName: lead.companyName,
      ownerId: lead.ownerId,
      ownerName: lead.ownerName,
      status: lead.status,
      estimatedValue: lead.estimatedValue,
      ...scoreLead({
        status: lead.status,
        phone: lead.phone,
        email: lead.email,
        companyName: lead.companyName,
        source: lead.source,
        estimatedValue: lead.estimatedValue,
        ownerId: lead.ownerId,
        notes: lead.notes,
        createdAt: lead.createdAt,
        completedActivities: activity?.completedActivities ?? 0,
        openActivities: activity?.openActivities ?? 0,
        overdueActivities: activity?.overdueActivities ?? 0,
        lastInteractionAt: activity?.lastInteractionAt ?? null,
        nextFollowUpAt: activity?.nextFollowUpAt ?? null,
      }),
    };
  });

  const activeScores = scores
    .filter((item) => item.status !== "converted" && item.status !== "unqualified")
    .sort((a, b) => b.score - a.score);

  const scoreSummary = {
    active: activeScores.length,
    hot: activeScores.filter((item) => item.grade === "hot").length,
    warm: activeScores.filter((item) => item.grade === "warm").length,
    cold: activeScores.filter((item) => item.grade === "cold").length,
    inactive: activeScores.filter((item) => item.grade === "inactive").length,
    averageScore:
      activeScores.length > 0
        ? Math.round(activeScores.reduce((sum, item) => sum + item.score, 0) / activeScores.length)
        : 0,
  };

  return {
    leadScoring: {
      summary: scoreSummary,
      leads: scores.sort((a, b) => b.score - a.score),
    },
    forecast: buildSalesForecast(
      openDeals.map((deal) => ({
        id: deal.id,
        value: Number(deal.value ?? 0),
        probability: deal.probability,
        expectedCloseAt: deal.expectedCloseAt,
        ownerId: deal.ownerId,
        ownerName: deal.ownerName,
      })),
    ),
  };
}