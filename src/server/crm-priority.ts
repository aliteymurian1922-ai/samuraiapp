import "server-only";

import { listLeads } from "@/server/crm";
import { buildSalesForecast } from "@/server/sales-forecast";
import { calculateDealPriority } from "@/lib/crm/deal-priority";

export async function buildCrmPriorityQueue(workspaceId: string) {
  const [leads, forecast] = await Promise.all([
    listLeads(workspaceId),
    buildSalesForecast(workspaceId),
  ]);

  const leadItems = leads
    .filter((lead) => lead.priorityBand !== "done")
    .sort((a, b) =>
      b.priorityScore - a.priorityScore ||
      Number(b.estimatedValue ?? 0) - Number(a.estimatedValue ?? 0),
    )
    .slice(0, 12)
    .map((lead) => ({
      kind: "lead" as const,
      id: lead.id,
      title: lead.name,
      subtitle: lead.companyName || lead.ownerName || "سرنخ فروش",
      value: Number(lead.estimatedValue ?? 0),
      score: lead.score,
      priorityScore: lead.priorityScore,
      priorityBand: lead.priorityBand,
      reasons: lead.reasons,
      recommendedAction: lead.recommendedAction,
      href: `/app/crm/leads/${lead.id}`,
      dueAt: lead.nextFollowUpAt,
    }));

  const maxDealValue = forecast.riskDeals.reduce(
    (maxValue, deal) => Math.max(maxValue, Number(deal.value ?? 0)),
    0,
  );

  const dealItems = forecast.riskDeals
    .map((deal) => {
      const priority = calculateDealPriority({
        status: "open",
        value: Number(deal.value ?? 0),
        maxValue: maxDealValue,
        probability: Number(deal.probability ?? 0),
        expectedCloseAt: deal.expectedCloseAt,
        nextFollowUpAt: deal.nextFollowUpAt,
        reasons: deal.reasons,
      });

      return {
        kind: "deal" as const,
        id: deal.id,
        title: deal.title,
        subtitle: [deal.stageName, deal.ownerName].filter(Boolean).join(" · ") || "فرصت فروش",
        value: Number(deal.value ?? 0),
        score: Number(deal.probability ?? 0),
        priorityScore: priority.priorityScore,
        priorityBand: priority.priorityBand,
        reasons: priority.reasons,
        recommendedAction: priority.recommendedAction,
        href: `/app/crm/deals/${deal.id}`,
        dueAt: deal.nextFollowUpAt ?? deal.expectedCloseAt,
      };
    })
    .filter((item) => item.priorityBand !== "done")
    .sort((a, b) => b.priorityScore - a.priorityScore || b.value - a.value)
    .slice(0, 12);

  const items = [...leadItems, ...dealItems]
    .sort((a, b) => b.priorityScore - a.priorityScore || b.value - a.value)
    .slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: items.length,
      urgent: items.filter((item) => item.priorityBand === "urgent").length,
      high: items.filter((item) => item.priorityBand === "high").length,
      leads: leadItems.length,
      deals: dealItems.length,
    },
    items,
  };
}

export type CrmPriorityQueue = Awaited<ReturnType<typeof buildCrmPriorityQueue>>;
