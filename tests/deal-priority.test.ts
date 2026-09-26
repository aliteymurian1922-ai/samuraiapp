import { describe, expect, it } from "vitest";
import { calculateDealPriority } from "@/lib/crm/deal-priority";

const now = new Date("2026-09-26T12:00:00.000Z");

describe("calculateDealPriority", () => {
  it("raises priority for an overdue high-value deal without a next action", () => {
    const result = calculateDealPriority({
      status: "open",
      value: 50_000_000,
      maxValue: 50_000_000,
      probability: 20,
      expectedCloseAt: "2026-09-20T12:00:00.000Z",
      nextFollowUpAt: null,
      reasons: ["موعد بستن گذشته", "پیگیری آینده ثبت نشده"],
      now,
    });

    expect(result.priorityBand).toBe("urgent");
    expect(result.priorityScore).toBeGreaterThanOrEqual(72);
    expect(result.recommendedAction).toContain("امروز");
  });

  it("keeps a healthy scheduled deal below urgent", () => {
    const result = calculateDealPriority({
      status: "open",
      value: 20_000_000,
      maxValue: 50_000_000,
      probability: 70,
      expectedCloseAt: "2026-10-20T12:00:00.000Z",
      nextFollowUpAt: "2026-10-02T12:00:00.000Z",
      reasons: [],
      now,
    });

    expect(result.priorityBand).not.toBe("urgent");
    expect(result.priorityScore).toBeLessThan(72);
  });

  it("removes closed deals from the active queue", () => {
    const result = calculateDealPriority({
      status: "won",
      value: 20_000_000,
      maxValue: 50_000_000,
      probability: 100,
      expectedCloseAt: null,
      nextFollowUpAt: null,
      reasons: [],
      now,
    });

    expect(result.priorityBand).toBe("done");
    expect(result.priorityScore).toBe(0);
  });
});
