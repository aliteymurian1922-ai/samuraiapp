import { describe, expect, it } from "vitest";
import { calculateLeadScore } from "@/lib/crm/lead-scoring";

const now = new Date("2026-09-26T12:00:00.000Z");

function base() {
  return {
    status: "new" as const,
    estimatedValue: 10_000_000,
    maxEstimatedValue: 20_000_000,
    phone: "09120000000",
    email: "lead@example.com",
    companyName: "نمونه",
    source: "سایت",
    ownerId: "owner-1",
    notes: "نیاز اولیه ثبت شده",
    createdAt: new Date("2026-09-20T12:00:00.000Z"),
    updatedAt: new Date("2026-09-25T12:00:00.000Z"),
    totalActivities: 0,
    completedActivities: 0,
    overdueFollowUps: 0,
    nextFollowUpAt: null,
    lastActivityAt: null,
    now,
  };
}

describe("calculateLeadScore", () => {
  it("prioritizes a qualified, engaged lead with a near follow-up", () => {
    const result = calculateLeadScore({
      ...base(),
      status: "qualified",
      estimatedValue: 20_000_000,
      completedActivities: 3,
      totalActivities: 4,
      nextFollowUpAt: new Date("2026-09-28T12:00:00.000Z"),
      lastActivityAt: new Date("2026-09-26T08:00:00.000Z"),
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.band).toBe("hot");
    expect(result.reasons).toContain("سرنخ واجد شرایط است.");
  });

  it("penalizes stale leads without a next action", () => {
    const result = calculateLeadScore({
      ...base(),
      phone: null,
      email: null,
      companyName: null,
      source: null,
      ownerId: null,
      notes: null,
      estimatedValue: null,
      updatedAt: new Date("2026-08-10T12:00:00.000Z"),
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
    });

    expect(result.score).toBeLessThan(30);
    expect(result.band).toBe("cold");
    expect(result.reasons).toContain("اقدام بعدی برای این سرنخ مشخص نشده است.");
  });

  it("penalizes overdue follow-ups", () => {
    const healthy = calculateLeadScore({
      ...base(),
      status: "contacted",
      nextFollowUpAt: new Date("2026-09-28T12:00:00.000Z"),
    });

    const overdue = calculateLeadScore({
      ...base(),
      status: "contacted",
      overdueFollowUps: 1,
    });

    expect(overdue.score).toBeLessThan(healthy.score);
    expect(overdue.reasons).toContain("پیگیری عقب‌افتاده دارد.");
  });

  it("treats converted and unqualified leads explicitly", () => {
    expect(calculateLeadScore({ ...base(), status: "converted" }).band).toBe("converted");
    expect(calculateLeadScore({ ...base(), status: "converted" }).score).toBe(100);
    expect(calculateLeadScore({ ...base(), status: "unqualified" }).band).toBe("inactive");
    expect(calculateLeadScore({ ...base(), status: "unqualified" }).score).toBe(0);
  });
});
