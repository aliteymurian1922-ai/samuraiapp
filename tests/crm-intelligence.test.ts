import { describe, expect, it } from "vitest";
import { buildSalesForecast, scoreLead } from "@/lib/crm-intelligence";

describe("scoreLead", () => {
  it("scores a qualified and engaged lead as hot", () => {
    const result = scoreLead(
      {
        status: "qualified",
        phone: "09120000000",
        email: "lead@example.com",
        companyName: "سامانه نمونه",
        source: "معرفی",
        estimatedValue: 60_000_000,
        ownerId: "owner-1",
        notes: "نیاز مشخص شده",
        createdAt: "2026-09-20T00:00:00Z",
        completedActivities: 2,
        openActivities: 1,
        overdueActivities: 0,
        lastInteractionAt: "2026-09-25T00:00:00Z",
        nextFollowUpAt: "2026-09-27T00:00:00Z",
      },
      new Date("2026-09-26T00:00:00Z"),
    );

    expect(result.score).toBe(100);
    expect(result.grade).toBe("hot");
    expect(result.reasons.some((reason) => reason.label === "واجد شرایط")).toBe(true);
  });

  it("penalizes stale and overdue leads", () => {
    const result = scoreLead(
      {
        status: "contacted",
        phone: null,
        email: null,
        companyName: null,
        source: null,
        estimatedValue: null,
        ownerId: null,
        notes: null,
        createdAt: "2026-07-01T00:00:00Z",
        completedActivities: 0,
        openActivities: 1,
        overdueActivities: 2,
        lastInteractionAt: "2026-07-10T00:00:00Z",
        nextFollowUpAt: "2026-08-01T00:00:00Z",
      },
      new Date("2026-09-26T00:00:00Z"),
    );

    expect(result.score).toBeLessThan(25);
    expect(result.reasons.some((reason) => reason.impact < 0)).toBe(true);
  });

  it("marks converted leads as complete", () => {
    const result = scoreLead({
      status: "converted",
      phone: null,
      email: null,
      companyName: null,
      source: null,
      estimatedValue: null,
      ownerId: null,
      notes: null,
      createdAt: new Date(),
      completedActivities: 0,
      openActivities: 0,
      overdueActivities: 0,
      lastInteractionAt: null,
      nextFollowUpAt: null,
    });

    expect(result.score).toBe(100);
    expect(result.grade).toBe("hot");
  });
});

describe("buildSalesForecast", () => {
  it("builds weighted, commit and overdue forecast", () => {
    const result = buildSalesForecast(
      [
        {
          id: "a",
          value: 100,
          probability: 80,
          expectedCloseAt: "2026-09-28T00:00:00Z",
          ownerId: "u1",
          ownerName: "علی",
        },
        {
          id: "b",
          value: 200,
          probability: 40,
          expectedCloseAt: "2026-10-10T00:00:00Z",
          ownerId: "u1",
          ownerName: "علی",
        },
        {
          id: "c",
          value: 50,
          probability: 70,
          expectedCloseAt: "2026-09-01T00:00:00Z",
          ownerId: null,
          ownerName: null,
        },
        {
          id: "d",
          value: 25,
          probability: 20,
          expectedCloseAt: null,
          ownerId: null,
          ownerName: null,
        },
      ],
      new Date("2026-09-26T00:00:00Z"),
    );

    expect(result.summary.pipelineValue).toBe(375);
    expect(result.summary.weightedForecast).toBe(200);
    expect(result.summary.commitForecast).toBe(100);
    expect(result.summary.overdueDeals).toBe(1);
    expect(result.summary.overdueValue).toBe(50);
    expect(result.summary.noDateDeals).toBe(1);
    expect(result.months[0].pipelineValue).toBe(100);
    expect(result.months[1].pipelineValue).toBe(200);
    expect(result.owners[0].ownerName).toBe("علی");
  });
});
