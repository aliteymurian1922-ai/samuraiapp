import "server-only";

import { db } from "@/db";
import {
  crmActivities,
  crmDeals,
  crmPipelineStages,
  users,
} from "@/db/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

export async function buildSalesForecast(workspaceId: string) {
  const [summaryRows, stageRows, teamRows, trendRows, riskRows] = await Promise.all([
    db
      .select({
        openDeals: sql<number>`count(*) filter (where ${crmDeals.status} = 'open')::int`,
        openValue: sql<number>`coalesce(sum(${crmDeals.value}) filter (where ${crmDeals.status} = 'open'), 0)::bigint`,
        weightedOpenValue: sql<number>`
          coalesce(
            sum(round(${crmDeals.value} * ${crmPipelineStages.probability} / 100.0))
              filter (where ${crmDeals.status} = 'open'),
            0
          )::bigint
        `,
        wonThisMonth: sql<number>`
          coalesce(
            sum(${crmDeals.value})
              filter (
                where ${crmDeals.status} = 'won'
                  and ${crmDeals.wonAt} >= date_trunc('month', now())
                  and ${crmDeals.wonAt} < date_trunc('month', now()) + interval '1 month'
              ),
            0
          )::bigint
        `,
        wonCountThisMonth: sql<number>`
          count(*)
            filter (
              where ${crmDeals.status} = 'won'
                and ${crmDeals.wonAt} >= date_trunc('month', now())
                and ${crmDeals.wonAt} < date_trunc('month', now()) + interval '1 month'
            )::int
        `,
        lostCountThisMonth: sql<number>`
          count(*)
            filter (
              where ${crmDeals.status} = 'lost'
                and ${crmDeals.lostAt} >= date_trunc('month', now())
                and ${crmDeals.lostAt} < date_trunc('month', now()) + interval '1 month'
            )::int
        `,
        weightedDueThisMonth: sql<number>`
          coalesce(
            sum(round(${crmDeals.value} * ${crmPipelineStages.probability} / 100.0))
              filter (
                where ${crmDeals.status} = 'open'
                  and ${crmDeals.expectedCloseAt} >= date_trunc('month', now())
                  and ${crmDeals.expectedCloseAt} < date_trunc('month', now()) + interval '1 month'
              ),
            0
          )::bigint
        `,
        overdueOpenDeals: sql<number>`
          count(*)
            filter (
              where ${crmDeals.status} = 'open'
                and ${crmDeals.expectedCloseAt} is not null
                and ${crmDeals.expectedCloseAt} < now()
            )::int
        `,
      })
      .from(crmDeals)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
      .where(eq(crmDeals.workspaceId, workspaceId)),

    db
      .select({
        stageId: crmPipelineStages.id,
        stageName: crmPipelineStages.name,
        probability: crmPipelineStages.probability,
        position: crmPipelineStages.position,
        deals: sql<number>`count(${crmDeals.id})::int`,
        value: sql<number>`coalesce(sum(${crmDeals.value}), 0)::bigint`,
        weightedValue: sql<number>`
          coalesce(sum(round(${crmDeals.value} * ${crmPipelineStages.probability} / 100.0)), 0)::bigint
        `,
      })
      .from(crmDeals)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
      .where(
        and(
          eq(crmDeals.workspaceId, workspaceId),
          eq(crmDeals.status, "open"),
        ),
      )
      .groupBy(
        crmPipelineStages.id,
        crmPipelineStages.name,
        crmPipelineStages.probability,
        crmPipelineStages.position,
      )
      .orderBy(asc(crmPipelineStages.position)),

    db
      .select({
        ownerId: crmDeals.ownerId,
        ownerName: users.name,
        openDeals: sql<number>`count(*) filter (where ${crmDeals.status} = 'open')::int`,
        openValue: sql<number>`coalesce(sum(${crmDeals.value}) filter (where ${crmDeals.status} = 'open'), 0)::bigint`,
        weightedValue: sql<number>`
          coalesce(
            sum(round(${crmDeals.value} * ${crmPipelineStages.probability} / 100.0))
              filter (where ${crmDeals.status} = 'open'),
            0
          )::bigint
        `,
        wonValueThisMonth: sql<number>`
          coalesce(
            sum(${crmDeals.value})
              filter (
                where ${crmDeals.status} = 'won'
                  and ${crmDeals.wonAt} >= date_trunc('month', now())
                  and ${crmDeals.wonAt} < date_trunc('month', now()) + interval '1 month'
              ),
            0
          )::bigint
        `,
        wonCountThisMonth: sql<number>`
          count(*)
            filter (
              where ${crmDeals.status} = 'won'
                and ${crmDeals.wonAt} >= date_trunc('month', now())
                and ${crmDeals.wonAt} < date_trunc('month', now()) + interval '1 month'
            )::int
        `,
        lostCountThisMonth: sql<number>`
          count(*)
            filter (
              where ${crmDeals.status} = 'lost'
                and ${crmDeals.lostAt} >= date_trunc('month', now())
                and ${crmDeals.lostAt} < date_trunc('month', now()) + interval '1 month'
            )::int
        `,
      })
      .from(crmDeals)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
      .leftJoin(users, eq(users.id, crmDeals.ownerId))
      .where(eq(crmDeals.workspaceId, workspaceId))
      .groupBy(crmDeals.ownerId, users.name)
      .orderBy(desc(sql`coalesce(sum(${crmDeals.value}) filter (where ${crmDeals.status} = 'won'), 0)`)),

    db.execute(sql`
      with months as (
        select generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) as month_start
      )
      select
        to_char(months.month_start, 'YYYY-MM') as month,
        coalesce(sum(d.value), 0)::bigint as "wonValue",
        count(d.id)::int as "wonDeals"
      from months
      left join crm_deals d
        on d.workspace_id = ${workspaceId}
       and d.status = 'won'
       and d.won_at >= months.month_start
       and d.won_at < months.month_start + interval '1 month'
      group by months.month_start
      order by months.month_start
    `),

    db
      .select({
        id: crmDeals.id,
        title: crmDeals.title,
        value: crmDeals.value,
        expectedCloseAt: crmDeals.expectedCloseAt,
        ownerName: users.name,
        stageName: crmPipelineStages.name,
        probability: crmPipelineStages.probability,
        nextFollowUpAt: sql<Date | null>`
          min(${crmActivities.dueAt})
            filter (
              where ${crmActivities.completedAt} is null
                and ${crmActivities.dueAt} >= now()
            )
        `,
      })
      .from(crmDeals)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
      .leftJoin(users, eq(users.id, crmDeals.ownerId))
      .leftJoin(
        crmActivities,
        and(
          eq(crmActivities.dealId, crmDeals.id),
          eq(crmActivities.workspaceId, workspaceId),
        ),
      )
      .where(
        and(
          eq(crmDeals.workspaceId, workspaceId),
          eq(crmDeals.status, "open"),
        ),
      )
      .groupBy(
        crmDeals.id,
        crmDeals.title,
        crmDeals.value,
        crmDeals.expectedCloseAt,
        users.name,
        crmPipelineStages.name,
        crmPipelineStages.probability,
      )
      .orderBy(asc(crmDeals.expectedCloseAt))
      .limit(50),
  ]);

  const summary = summaryRows[0] ?? {
    openDeals: 0,
    openValue: 0,
    weightedOpenValue: 0,
    wonThisMonth: 0,
    wonCountThisMonth: 0,
    lostCountThisMonth: 0,
    weightedDueThisMonth: 0,
    overdueOpenDeals: 0,
  };

  const decidedThisMonth = summary.wonCountThisMonth + summary.lostCountThisMonth;
  const winRateThisMonth = decidedThisMonth
    ? Math.round((summary.wonCountThisMonth / decidedThisMonth) * 100)
    : 0;

  const riskDeals = riskRows
    .map((deal) => {
      const reasons: string[] = [];
      const closeTime = deal.expectedCloseAt ? new Date(deal.expectedCloseAt).getTime() : null;

      if (closeTime !== null && closeTime < new Date().getTime()) {
        reasons.push("موعد بستن گذشته");
      }
      if (!deal.nextFollowUpAt) {
        reasons.push("پیگیری آینده ثبت نشده");
      }
      if (deal.probability <= 25) {
        reasons.push("احتمال مرحله پایین است");
      }

      return {
        ...deal,
        reasons,
      };
    })
    .filter((deal) => deal.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || Number(b.value) - Number(a.value))
    .slice(0, 10);

  const team = teamRows.map((member) => {
    const decided = member.wonCountThisMonth + member.lostCountThisMonth;
    return {
      ...member,
      ownerName: member.ownerName ?? "بدون مسئول",
      winRateThisMonth: decided ? Math.round((member.wonCountThisMonth / decided) * 100) : 0,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      winRateThisMonth,
      forecastThisMonth: Number(summary.wonThisMonth) + Number(summary.weightedDueThisMonth),
    },
    stages: stageRows,
    team,
    trend: trendRows.rows.map((row) => ({
      month: String(row.month),
      wonValue: Number(row.wonValue),
      wonDeals: Number(row.wonDeals),
    })),
    riskDeals,
  };
}

export type SalesForecastReport = Awaited<ReturnType<typeof buildSalesForecast>>;
